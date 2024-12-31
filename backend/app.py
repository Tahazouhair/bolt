from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import os
from functools import wraps
import requests
from bs4 import BeautifulSoup
import json
import sqlite3
from datetime import datetime, timedelta
import time

app = Flask(__name__)
CORS(app,
    resources={r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001", "https://tahazouhair.github.io", "https://bolt-backend-xu7f.onrender.com"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "send_wildcard": False
    }}
)

# Configuration
print("Loading configuration...")
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key')
database_url = os.environ.get('DATABASE_URL', 'sqlite:///dashboard.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

# Add SSL mode to PostgreSQL URL if not already present
if 'postgresql://' in database_url and '?' not in database_url:
    database_url += '?sslmode=require'

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
print(f"Database URL: {database_url}")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
print("Initializing database...")
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

def init_db():
    print("Running database initialization...")
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            with app.app_context():
                db.create_all()
                print("Database tables created successfully")
                return True
        except Exception as e:
            retry_count += 1
            print(f"Error creating database tables (attempt {retry_count}/{max_retries}): {str(e)}")
            if retry_count < max_retries:
                print("Retrying in 5 seconds...")
                time.sleep(5)
            else:
                print("Max retries reached. Database initialization failed.")
                return False

def init_scrape_cache():
    conn = sqlite3.connect('scrape_cache.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS scrape_cache
                 (url TEXT PRIMARY KEY, brand TEXT, price TEXT, timestamp DATETIME)''')
    conn.commit()
    conn.close()

# Initialize the database
init_db()
init_scrape_cache()

# Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    activities = db.relationship('Activity', backref='user', lazy=True)
    teams = db.relationship('Team', secondary='team_member', back_populates='members')

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_department = db.Column(db.Boolean, default=False)
    manual_members = db.Column(db.Text, nullable=True)  # Store as comma-separated names
    members = db.relationship('User', secondary='team_member', back_populates='teams')

class TeamMember(db.Model):
    __tablename__ = 'team_member'
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    joined_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(200), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        try:
            token = token.split()[1]  # Remove 'Bearer ' prefix
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'message': 'Invalid user'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        except Exception as e:
            print(f"Token error: {str(e)}")  # Debug log
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def clean_brand_name(brand_name):
    if not brand_name:
        return None
        
    # Remove common suffixes
    suffixes_to_remove = [
        'NEW TO SALE',
        'NEW SEASON',
        'TO SALE',
        'NEW',
        'SEASON'
    ]
    
    brand = brand_name.strip()
    for suffix in suffixes_to_remove:
        if brand.upper().endswith(suffix):
            brand = brand[:-(len(suffix))].strip()
    
    return brand.strip()

@app.route('/api/login', methods=['POST'])
def login():
    try:
        print("Login attempt received")
        data = request.get_json()
        
        if not data:
            print("No JSON data received")
            return jsonify({'message': 'No data provided'}), 400
            
        if 'username' not in data or 'password' not in data:
            print("Missing username or password")
            return jsonify({'message': 'Missing username or password'}), 400
            
        username = data['username']
        password = data['password']
        
        print(f"Attempting login for user: {username}")
        user = User.query.filter_by(username=username).first()
        
        if not user:
            print(f"User not found: {username}")
            return jsonify({'message': 'Invalid username or password'}), 401
            
        if not check_password_hash(user.password, password):
            print(f"Invalid password for user: {username}")
            return jsonify({'message': 'Invalid username or password'}), 401
            
        print(f"Login successful for user: {username}")
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=1)
        }, app.config['SECRET_KEY'])
        
        # Log the successful login
        new_activity = Activity(user_id=user.id, action='User logged in')
        db.session.add(new_activity)
        db.session.commit()
        
        return jsonify({
            'token': token,
            'user': {
                'username': user.username,
                'role': user.role
            }
        })
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return jsonify({'message': 'Server error during login. Please try again.'}), 500

@app.route('/api/logout', methods=['POST'])
@token_required
def logout(current_user):
    # Log the logout activity
    new_activity = Activity(user_id=current_user.id, action='User logged out')
    db.session.add(new_activity)
    db.session.commit()
    return jsonify({'message': 'Successfully logged out'})

@app.route('/api/activities', methods=['GET'])
@token_required
def get_activities(current_user):
    if current_user.role not in ['admin', 'moderator']:
        return jsonify({'message': 'Unauthorized'}), 403
        
    activities = Activity.query.order_by(Activity.timestamp.desc()).limit(50).all()
    return jsonify([{
        'id': activity.id,
        'user': activity.user.username,
        'action': activity.action,
        'timestamp': activity.timestamp.isoformat()
    } for activity in activities])

@app.route('/api/setup-admin', methods=['POST'])
def setup_admin():
    try:
        if User.query.filter_by(role='admin').first():
            return jsonify({'message': 'Admin already exists'}), 400
            
        data = request.get_json()
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'message': 'Missing username or password'}), 400
            
        print(f"Creating admin user with username: {data['username']}")  # Debug log
        
        hashed_password = generate_password_hash(data['password'], method='sha256')
        admin = User(username=data['username'], password=hashed_password, role='admin')
        
        db.session.add(admin)
        db.session.commit()
        
        print("Admin user created successfully")  # Debug log
        
        return jsonify({
            'message': 'Admin user created successfully',
            'user': {
                'username': admin.username,
                'role': admin.role
            }
        })
    except Exception as e:
        print(f"Error creating admin: {str(e)}")  # Debug log
        db.session.rollback()
        return jsonify({'message': f'Error creating admin: {str(e)}'}), 500

@app.route('/api/users', methods=['GET'])
@token_required
def get_users(current_user):
    if current_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403
        
    users = User.query.all()
    return jsonify([{
        'id': user.id,
        'username': user.username,
        'role': user.role
    } for user in users])

@app.route('/api/users', methods=['POST'])
@token_required
def create_user(current_user):
    if current_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403
        
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data or 'role' not in data:
        return jsonify({'message': 'Missing required fields'}), 400
        
    if data['role'] not in ['admin', 'moderator', 'user']:
        return jsonify({'message': 'Invalid role'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
        
    hashed_password = generate_password_hash(data['password'], method='sha256')
    new_user = User(username=data['username'], password=hashed_password, role=data['role'])
    
    db.session.add(new_user)
    db.session.add(Activity(user_id=current_user.id, action=f'Created new user: {data["username"]} with role: {data["role"]}'))
    db.session.commit()
    
    return jsonify({
        'message': 'User created successfully',
        'user': {
            'id': new_user.id,
            'username': new_user.username,
            'role': new_user.role
        }
    })

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    if current_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    data = request.get_json()
    if 'username' in data:
        user.username = data['username']
    if 'role' in data:
        user.role = data['role']
    if 'password' in data and data['password']:
        user.password = generate_password_hash(data['password'])

    # Log the user update activity
    new_activity = Activity(
        user_id=current_user.id,
        action=f'Updated user {user.username} (role: {user.role})'
    )
    db.session.add(new_activity)
    db.session.commit()

    return jsonify({
        'id': user.id,
        'username': user.username,
        'role': user.role
    })

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
def delete_user(current_user, user_id):
    if current_user.role != 'admin':
        return jsonify({'message': 'Unauthorized'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    username = user.username
    db.session.delete(user)
    
    # Log the user deletion activity
    new_activity = Activity(
        user_id=current_user.id,
        action=f'Deleted user {username}'
    )
    db.session.add(new_activity)
    db.session.commit()

    return jsonify({'message': 'User deleted successfully'})

@app.route('/api/teams', methods=['GET'])
@token_required
def get_teams(current_user):
    try:
        teams = Team.query.all()
        return jsonify([{
            'id': team.id,
            'name': team.name,
            'description': team.description,
            'created_at': team.created_at.isoformat(),
            'is_department': team.is_department,
            'manual_members': team.manual_members,
            'members': [{
                'id': member.id,
                'username': member.username
            } for member in team.members]
        } for team in teams])
    except Exception as e:
        print(f"Error fetching teams: {str(e)}")  # Debug log
        return jsonify({'message': 'Failed to fetch teams'}), 500

@app.route('/api/teams', methods=['POST'])
@token_required
def create_team(current_user):
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'message': 'Missing team name'}), 400

    new_team = Team(
        name=data['name'],
        description=data.get('description', ''),
        is_department=data.get('is_department', False),
        manual_members=data.get('manual_members', '')
    )
    
    db.session.add(new_team)
    db.session.add(Activity(user_id=current_user.id, action=f'Created new team: {data["name"]}'))
    db.session.commit()
    
    return jsonify({
        'message': 'Team created successfully',
        'team': {
            'id': new_team.id,
            'name': new_team.name,
            'description': new_team.description,
            'created_at': new_team.created_at.isoformat(),
            'is_department': new_team.is_department,
            'manual_members': new_team.manual_members
        }
    })

@app.route('/api/teams/<int:team_id>', methods=['PUT'])
@token_required
def update_team(current_user, team_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({'message': 'Team not found'}), 404

    data = request.get_json()
    if 'name' in data:
        team.name = data['name']
    if 'description' in data:
        team.description = data['description']
    if 'is_department' in data:
        team.is_department = data['is_department']
    if 'manual_members' in data:
        team.manual_members = data['manual_members']

    db.session.add(Activity(user_id=current_user.id, action=f'Updated team: {team.name}'))
    db.session.commit()

    return jsonify({
        'message': 'Team updated successfully',
        'team': {
            'id': team.id,
            'name': team.name,
            'description': team.description,
            'created_at': team.created_at.isoformat(),
            'is_department': team.is_department,
            'manual_members': team.manual_members
        }
    })

@app.route('/api/teams/<int:team_id>', methods=['DELETE'])
@token_required
def delete_team(current_user, team_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({'message': 'Team not found'}), 404

    db.session.delete(team)
    db.session.add(Activity(user_id=current_user.id, action=f'Deleted team: {team.name}'))
    db.session.commit()

    return jsonify({'message': 'Team deleted successfully'})

@app.route('/api/teams/<int:team_id>/members', methods=['POST'])
@token_required
def add_team_member(current_user, team_id):
    data = request.get_json()
    if not data or 'userId' not in data:
        return jsonify({'message': 'Missing user ID'}), 400

    team = Team.query.get(team_id)
    if not team:
        return jsonify({'message': 'Team not found'}), 404

    user = User.query.get(data['userId'])
    if not user:
        return jsonify({'message': 'User not found'}), 404

    if user in team.members:
        return jsonify({'message': 'User is already a member of this team'}), 400

    team.members.append(user)
    db.session.add(Activity(user_id=current_user.id, action=f'Added {user.username} to team: {team.name}'))
    db.session.commit()

    return jsonify({
        'message': 'Member added successfully',
        'member': {
            'id': user.id,
            'username': user.username
        }
    })

@app.route('/api/teams/<int:team_id>/members/<int:user_id>', methods=['DELETE'])
@token_required
def remove_team_member(current_user, team_id, user_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({'message': 'Team not found'}), 404

    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    if user not in team.members:
        return jsonify({'message': 'User is not a member of this team'}), 400

    team.members.remove(user)
    db.session.add(Activity(user_id=current_user.id, action=f'Removed {user.username} from team: {team.name}'))
    db.session.commit()

    return jsonify({'message': 'Member removed successfully'})

@app.route('/api/update-password', methods=['POST'])
@token_required
def update_password(current_user):
    try:
        data = request.get_json()
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')

        if not current_password or not new_password:
            return jsonify({'message': 'Missing required fields'}), 400

        # Verify current password
        if not check_password_hash(current_user.password, current_password):
            return jsonify({'message': 'Current password is incorrect'}), 401

        # Update password
        current_user.password = generate_password_hash(new_password)
        db.session.commit()

        # Log the activity
        activity = Activity(user_id=current_user.id, action='Password updated')
        db.session.add(activity)
        db.session.commit()

        return jsonify({'message': 'Password updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@app.route('/api/scrape-brand', methods=['POST'])
def scrape_brand():
    try:
        url = request.json.get('url')
        print(f"\n=== Starting brand scraping for URL: {url} ===")
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        # Check cache first
        conn = sqlite3.connect('scrape_cache.db')
        c = conn.cursor()
        c.execute('SELECT brand, price, timestamp FROM scrape_cache WHERE url = ?', (url,))
        cache_result = c.fetchone()
        
        # If we have a cached result less than 24 hours old, return it
        if cache_result:
            brand, price, timestamp = cache_result
            cache_time = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S.%f')
            if datetime.now() - cache_time < timedelta(hours=24):
                print(f"Cache hit for {url}")
                return jsonify({
                    'brand': brand,
                    'price': price,
                    'cached': True
                })

        # Make the request to the URL with a timeout
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        
        # Parse the HTML using lxml for faster parsing
        soup = BeautifulSoup(response.text, 'lxml')
        
        # Try multiple methods to find the brand name
        brand_name = None
        selectors = [
            ('a[href^="/women/designers/"]', lambda x: x.text.strip()),
            ('a[href^="/men/designers/"]', lambda x: x.text.strip()),
            ('nav.breadcrumb a:last-child, nav.breadcrumbs a:last-child', lambda x: x.text.strip()),
            ('h1', lambda x: x.text.strip().split(' - ')[0].split(' | ')[0].strip())
        ]
        
        for selector, extractor in selectors:
            elements = soup.select(selector)
            if elements:
                brand_name = extractor(elements[0])
                if brand_name:
                    break

        # Find the price using CSS selector
        price = None
        price_element = soup.select_one('span.PriceContainer-price')
        if price_element:
            price = price_element.text.strip()
            print(f"Found price: {price}")
        
        if brand_name or price:
            # Update cache
            c.execute('''INSERT OR REPLACE INTO scrape_cache (url, brand, price, timestamp)
                        VALUES (?, ?, ?, ?)''', (url, brand_name, price, datetime.now()))
            conn.commit()
            
            print(f"Found brand name: {brand_name}")
            return jsonify({
                'brand': brand_name,
                'price': price,
                'cached': False
            })
        else:
            print("Brand name not found")
            return jsonify({'error': 'Brand name not found'}), 404

    except requests.RequestException as e:
        print(f"Request error: {str(e)}")
        return jsonify({'error': f'Failed to fetch URL: {str(e)}'}), 500
    except Exception as e:
        print(f"General error: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Create the database tables
with app.app_context():
    try:
        print("Checking database...")
        if not os.path.exists('dashboard.db'):
            print("Database not found, initializing...")
            db.create_all()
            setup_admin()
            print("Database initialized successfully!")
        else:
            print("Using existing database...")
    except Exception as e:
        print(f"Error initializing database: {e}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
