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

# Database Configuration
if os.environ.get('DATABASE_URL'):
    # Production PostgreSQL database
    database_url = os.environ.get('DATABASE_URL')
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    print(f"Using PostgreSQL database: {database_url}")
else:
    # Development SQLite database
    sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dashboard.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{sqlite_path}'
    print(f"Using SQLite database: {sqlite_path}")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

# Initialize extensions
print("Initializing database...")
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

def init_db():
    print("Running database initialization...")
    max_retries = 3
    retry_delay = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            print(f"Attempt {attempt + 1}/{max_retries} to initialize database...")
            
            # Test database connection
            db.engine.connect()
            print("Database connection successful")
            
            # Create tables
            db.create_all()
            print("Database tables created successfully")
            
            # Check if admin exists
            admin = User.query.filter_by(username='admin').first()
            if not admin:
                print("Creating default admin user...")
                hashed_password = generate_password_hash('admin')
                default_admin = User(
                    username='admin',
                    password=hashed_password,
                    role='admin'
                )
                db.session.add(default_admin)
                db.session.commit()
                print("Default admin user created successfully")
            else:
                print("Admin user already exists")
            
            return True
            
        except Exception as e:
            print(f"Error during database initialization (attempt {attempt + 1}): {str(e)}")
            if attempt < max_retries - 1:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("Max retries reached. Database initialization failed.")
                raise e

def init_scrape_cache():
    conn = sqlite3.connect('scrape_cache.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS scrape_cache
                 (url TEXT PRIMARY KEY, brand TEXT, price TEXT, timestamp TEXT)''')
    conn.commit()
    conn.close()

# Initialize the database
with app.app_context():
    try:
        print("Starting application initialization...")
        init_db()
        init_scrape_cache()
        print("Application initialization completed successfully")
    except Exception as e:
        print(f"Error during application initialization: {str(e)}")
        raise e

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

def normalize_price(price_str):
    if not price_str:
        return None
    # Remove currency symbols and non-numeric characters except dots and commas
    price_str = ''.join(c for c in price_str if c.isdigit() or c in '.,')
    # Convert to consistent format
    try:
        # Handle different decimal separators
        if ',' in price_str and '.' in price_str:
            if price_str.find(',') > price_str.find('.'):
                price_str = price_str.replace('.', '')  # European format
                price_str = price_str.replace(',', '.')
            else:
                price_str = price_str.replace(',', '')  # US format
        elif ',' in price_str:
            price_str = price_str.replace(',', '.')
        return "{:.2f}".format(float(price_str))
    except ValueError:
        return None

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
        print("Starting admin setup...")
        # Check if admin already exists
        admin = User.query.filter_by(username='admin').first()
        if admin:
            print("Admin already exists")
            return jsonify({'message': 'Admin already exists'}), 400

        print("Creating admin user...")
        # Create admin user
        hashed_password = generate_password_hash('admin')
        new_admin = User(
            username='admin',
            password=hashed_password,
            role='admin'
        )
        
        print("Adding admin to database...")
        db.session.add(new_admin)
        db.session.commit()
        print("Admin created successfully")
        
        # Create and return JWT token
        token = jwt.encode({
            'user_id': new_admin.id,
            'exp': datetime.utcnow() + timedelta(days=1)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'message': 'Admin account created successfully',
            'token': token,
            'user': {
                'username': new_admin.username,
                'role': new_admin.role
            }
        })
    except Exception as e:
        print(f"Error during admin setup: {str(e)}")
        db.session.rollback()
        return jsonify({'message': f'Error creating admin account: {str(e)}'}), 500

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

        # Ensure scrape_cache table exists
        try:
            conn = sqlite3.connect('scrape_cache.db')
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS scrape_cache
                        (url TEXT PRIMARY KEY, brand TEXT, price TEXT, timestamp TEXT)''')
            conn.commit()
            print("Database connection successful, table exists")
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return jsonify({'error': f'Database error: {str(e)}'}), 500
        
        try:
            # Check cache first
            c.execute('SELECT brand, price, timestamp FROM scrape_cache WHERE url = ?', (url,))
            cache_result = c.fetchone()
            
            # Validate and potentially invalidate cache
            if cache_result:
                brand, cached_price, timestamp = cache_result
                # Remove AED from cached price
                cached_price = cached_price.replace(' AED', '').replace('AED', '').strip()
                cache_time = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S.%f')
                
                # Invalidate cache if:
                # 1. More than 6 hours old
                # 2. Price seems unreasonably low (less than 10)
                # 3. Price contains suspicious characters
                if (datetime.now() - cache_time > timedelta(hours=6) or 
                    not cached_price or 
                    float(cached_price.replace(',', '')) < 10):
                    print(f"Cache invalidated for {url}")
                    cache_result = None
                else:
                    print(f"Cache hit for {url}")
                    return jsonify({
                        'brand': brand,
                        'price': cached_price,
                        'cached': True
                    })
        except sqlite3.Error as e:
            print(f"Cache lookup error: {e}")
            # Continue without cache if there's an error

        # Make the request to the URL with a timeout and retry mechanism
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10, verify=False)  # Added verify=False for testing
            response.raise_for_status()
            print(f"Successfully fetched URL: {url}")
            print(f"Response status code: {response.status_code}")
            print(f"Response headers: {response.headers}")
        except requests.RequestException as e:
            print(f"Request failed for {url}: {str(e)}")
            return jsonify({'error': f'Failed to fetch URL: {str(e)}'}), 500
        
        # Try parsing with lxml first, fall back to html.parser if it fails
        try:
            soup = BeautifulSoup(response.text, 'lxml')
            print("Successfully parsed HTML with lxml")
        except Exception as e:
            print(f"Failed to parse with lxml: {str(e)}")
            try:
                soup = BeautifulSoup(response.text, 'html.parser')
                print("Successfully parsed HTML with html.parser")
            except Exception as e:
                print(f"Failed to parse with html.parser: {str(e)}")
                return jsonify({'error': f'Failed to parse HTML: {str(e)}'}), 500

        # Print the first 1000 characters of the response for debugging
        print(f"First 1000 chars of response: {response.text[:1000]}")
        
        brand_name = None
        price = None
        
        try:
            # Enhanced selectors for brand name
            brand_selectors = [
                # Designer/brand specific links
                'a[href*="/designers/"], a[href*="/brands/"]',
                'a[href*="brand="], a[href*="designer="]',
                # Breadcrumb navigation
                'nav.breadcrumb a, nav.breadcrumbs a, .breadcrumb a, .breadcrumbs a',
                # Schema.org metadata
                '[itemprop="brand"], [itemprop="manufacturer"]',
                # Common brand containers
                '.brand-name, .product-brand, .designer-name',
                # Product title with brand
                'h1.product-title, h1.title, .product-name h1',
                # Meta tags
                'meta[property="og:brand"]',
                'meta[name="brand"]'
            ]
            
            # Try to find brand name
            for selector in brand_selectors:
                try:
                    elements = soup.select(selector)
                    print(f"Trying selector '{selector}': found {len(elements)} elements")
                    if elements:
                        for element in elements:
                            # Get text from meta tags differently
                            if element.name == 'meta':
                                potential_brand = element.get('content', '')
                            else:
                                potential_brand = element.text.strip()
                            
                            # Clean and validate the brand name
                            cleaned_brand = clean_brand_name(potential_brand)
                            if cleaned_brand and len(cleaned_brand) > 1:  # Avoid single characters
                                brand_name = cleaned_brand
                                print(f"Found brand name '{brand_name}' using selector '{selector}'")
                                break
                        if brand_name:
                            break
                except Exception as e:
                    print(f"Error with selector '{selector}': {str(e)}")
                    continue

            # Enhanced selectors for price
            price_selectors = [
                # Specific class you mentioned
                '.PriceContainer-slashedPrice',
                # Common price containers
                '.price, .product-price, .current-price',
                '[itemprop="price"]',
                '.price-container span',
                '.price__current, .price-current',
                # Sale prices
                '.sale-price, .special-price',
                # Main prices
                '.main-price, .regular-price',
                # Schema.org metadata
                '[data-price], [data-product-price]',
                # Specific price spans
                'span.PriceContainer-price, span[class*="price"]'
            ]
            
            # Try to find price
            for selector in price_selectors:
                try:
                    elements = soup.select(selector)
                    print(f"Trying price selector '{selector}': found {len(elements)} elements")
                    if elements:
                        for element in elements:
                            # Try data attributes first, then text
                            potential_price = element.get('data-price', element.get('content', element.text.strip()))
                            print(f"Found potential price: {potential_price}")
                            
                            # Return the original price string without AED
                            if potential_price:
                                price = potential_price.replace(' AED', '').replace('AED', '').strip()
                                print(f"Found price '{price}' using selector '{selector}'")
                                break
                        if price:
                            break
                except Exception as e:
                    print(f"Error with price selector '{selector}': {str(e)}")
                    continue

        except Exception as e:
            print(f"Error during scraping: {str(e)}")
            return jsonify({'error': f'Scraping error: {str(e)}'}), 500

        if brand_name or price:
            try:
                # Update cache with full price string and brand
                c.execute('''INSERT OR REPLACE INTO scrape_cache (url, brand, price, timestamp)
                            VALUES (?, ?, ?, ?)''', (url, brand_name, price, datetime.now()))
                conn.commit()
                print(f"Successfully cached data for {url}")
            except sqlite3.Error as e:
                print(f"Cache update error: {e}")
                # Continue without caching if there's an error
            
            print(f"Successfully scraped data - Brand: {brand_name}, Price: {price}")
            return jsonify({
                'brand': brand_name,
                'price': price,
                'cached': False
            })
        else:
            print("Brand name and price not found")
            return jsonify({'error': 'Brand name and price not found'}), 404

    except Exception as e:
        print(f"Unexpected error in scrape_brand: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Health check endpoint
@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy", "message": "Backend is running"}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
