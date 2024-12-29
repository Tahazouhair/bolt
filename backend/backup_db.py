import os
import shutil
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def backup_database():
    # Create backups directory if it doesn't exist
    backup_dir = os.path.join(os.path.dirname(__file__), 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    
    # Get current timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # List of databases to backup
    databases = ['dashboard.db', 'scrape_cache.db']
    
    for db_name in databases:
        try:
            # Source database path
            source_path = os.path.join(os.path.dirname(__file__), db_name)
            
            # Skip if source database doesn't exist
            if not os.path.exists(source_path):
                logging.warning(f"Database {db_name} not found, skipping backup")
                continue
            
            # Create backup filename with timestamp
            backup_filename = f"{db_name[:-3]}_{timestamp}.db"
            backup_path = os.path.join(backup_dir, backup_filename)
            
            # Create backup
            shutil.copy2(source_path, backup_path)
            logging.info(f"Successfully created backup of {db_name} at {backup_path}")
            
            # Clean up old backups (keep last 5 for each database)
            pattern = f"{db_name[:-3]}_*.db"
            backups = sorted([f for f in os.listdir(backup_dir) if f.startswith(db_name[:-3])])
            
            if len(backups) > 5:
                for old_backup in backups[:-5]:
                    old_backup_path = os.path.join(backup_dir, old_backup)
                    os.remove(old_backup_path)
                    logging.info(f"Removed old backup: {old_backup}")
                    
        except Exception as e:
            logging.error(f"Error backing up {db_name}: {str(e)}")

if __name__ == "__main__":
    backup_database()
