// API Configuration
export const API_URL = 'http://localhost:5000';

// Google Sheets Configuration
export const GOOGLE_SHEETS_CONFIG = {
  API_KEY: process.env.REACT_APP_API_KEY,
  QC_SHEET_ID: process.env.REACT_APP_QC_SHEET_ID || '19C-B-FiTNl1dirDg0H_5udNveCnlNPbF6LYyTp7M2L4',
  CASES_SHEET_ID: process.env.REACT_APP_CASES_SHEET_ID || '1M51SF6H9GaM7NlnpoDSUXCqC1ar4eMPljwUa59VcwAo',
  SHEET_RANGE: process.env.REACT_APP_SHEET_RANGE || 'Final view!A1:E',
  BRANDS_RANGE: process.env.REACT_APP_BRANDS_RANGE || 'Brands!C2:C'
};
