@echo off
echo Starting Bolt Application...

:: Start the backend server
cd backend
start cmd /k "python -m venv venv && venv\Scripts\activate && pip install -r ..\requirements.txt && python app.py"

:: Start the frontend server
cd ..\frontend
start cmd /k "npm install && npm start"

echo Servers are starting... Please wait a moment.
echo Frontend will be available at http://localhost:3000
echo Backend will be available at http://localhost:5000
