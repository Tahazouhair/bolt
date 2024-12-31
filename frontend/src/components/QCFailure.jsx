import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, ArrowDownTrayIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, FunnelIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

const QCFailure = () => {
  const [cases, setCases] = useState([]);
  const [decisions, setDecisions] = useState(() => {
    const savedDecisions = localStorage.getItem('qcDecisions');
    return savedDecisions ? JSON.parse(savedDecisions) : {};
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDecisions, setShowDecisions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewInitiated, setReviewInitiated] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [selectedCases, setSelectedCases] = useState(new Set());
  const [showLuxuryOnly, setShowLuxuryOnly] = useState(false);
  const [brandNames, setBrandNames] = useState(() => {
    const cached = localStorage.getItem('brandNames');
    return cached ? JSON.parse(cached) : {};
  });
  const [productPrices, setProductPrices] = useState(() => {
    const cached = localStorage.getItem('productPrices');
    return cached ? JSON.parse(cached) : {};
  });
  const [luxuryBrands, setLuxuryBrands] = useState(new Set());
  const [showWarning, setShowWarning] = useState(false);
  const [undecidedCases, setUndecidedCases] = useState([]);
  const [currentUndecidedIndex, setCurrentUndecidedIndex] = useState(0);
  const caseRefs = useRef({});

  // Get configuration from environment variables
  const sheetId = process.env.REACT_APP_QC_SHEET_ID;
  const range = process.env.REACT_APP_SHEET_RANGE;
  const brandsRange = process.env.REACT_APP_BRANDS_RANGE;
  const apiKey = process.env.REACT_APP_API_KEY;
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY = 1000; // 1 second

  const fetchWithRetry = async (url, options = {}, retryCount = 0) => {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        if (retryCount >= MAX_RETRIES) {
          throw new Error('Max retries reached for rate limit');
        }
        
        // Exponential backoff with jitter
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return fetchWithRetry(url, options, retryCount + 1);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      if (retryCount >= MAX_RETRIES) {
        throw error;
      }
      
      // Exponential backoff for network errors
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return fetchWithRetry(url, options, retryCount + 1);
    }
  };

  const getProductUrl = (sku) => {
    return `https://ounass.ae/${sku}.html`;
  };

  const scrapeBrandName = async (url) => {
    try {
      console.log('Fetching brand info for:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Create a temporary element to parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract brand name - using Ounass specific selectors
      let brand = null;
      const brandElement = doc.querySelector('.product-brand-name, [data-testid="brand-name"], .brand-link');
      if (brandElement) {
        brand = brandElement.textContent.trim();
      }
      
      // Extract price - using Ounass specific selectors
      let price = null;
      const priceElement = doc.querySelector('.product-price, [data-testid="product-price"], .price-sales');
      if (priceElement) {
        price = priceElement.textContent.trim();
      }
      
      console.log('Scraped data:', { brand, price });
      return { brand, price };
    } catch (error) {
      console.error('Error scraping details:', error);
      return { brand: null, price: null };
    }
  };

  const fetchBrandNames = async (products) => {
    const uniqueProducts = [...new Set(products)];
    const batchSize = 2; // Reduce batch size to avoid rate limiting
    
    for (let i = 0; i < uniqueProducts.length; i += batchSize) {
      const batch = uniqueProducts.slice(i, i + batchSize);
      const promises = batch.map(async (sku) => {
        const url = getProductUrl(sku);
        // Check if we already have the data in state or localStorage
        if (brandNames[url] && productPrices[url]) {
          return;
        }
        const { brand, price } = await scrapeBrandName(url);
        if (brand) {
          setBrandNames(prev => {
            const updated = {
              ...prev,
              [url]: brand
            };
            localStorage.setItem('brandNames', JSON.stringify(updated));
            return updated;
          });
        }
        if (price) {
          setProductPrices(prev => {
            const updated = {
              ...prev,
              [url]: price
            };
            localStorage.setItem('productPrices', JSON.stringify(updated));
            return updated;
          });
        }
      });
      
      await Promise.all(promises);
      // Longer delay between batches to be more respectful to the server
      if (i + batchSize < uniqueProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const fetchLuxuryBrands = async () => {
    try {
      // Check cache first
      const cachedData = localStorage.getItem('luxuryBrandsCache');
      const cacheTimestamp = localStorage.getItem('luxuryBrandsCacheTimestamp');
      
      if (cachedData && cacheTimestamp) {
        const timestamp = parseInt(cacheTimestamp);
        if (Date.now() - timestamp < CACHE_DURATION) {
          const brands = new Set(JSON.parse(cachedData));
          setLuxuryBrands(brands);
          return;
        }
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${brandsRange}?key=${apiKey}`;
      const data = await fetchWithRetry(url);

      if (data.values) {
        const brands = new Set();
        data.values.forEach(row => {
          if (row[0]) brands.add(normalizeBrandName(row[0]));
          if (row[1]) brands.add(normalizeBrandName(row[1]));
        });
        
        // Update cache
        localStorage.setItem('luxuryBrandsCache', JSON.stringify([...brands]));
        localStorage.setItem('luxuryBrandsCacheTimestamp', Date.now().toString());
        
        setLuxuryBrands(brands);
      }
    } catch (error) {
      console.error("Error fetching luxury brands:", error);
      // Try to use cached data even if expired
      const cachedData = localStorage.getItem('luxuryBrandsCache');
      if (cachedData) {
        setLuxuryBrands(new Set(JSON.parse(cachedData)));
      }
    }
  };

  const fetchData = async () => {
    try {
      // Check cache first
      const cachedData = localStorage.getItem('qcFailureDataCache');
      const cacheTimestamp = localStorage.getItem('qcFailureDataCacheTimestamp');
      
      if (cachedData && cacheTimestamp) {
        const timestamp = parseInt(cacheTimestamp);
        if (Date.now() - timestamp < CACHE_DURATION) {
          const parsedData = JSON.parse(cachedData);
          setCases(parsedData);
          setLoading(false);
          return parsedData;
        }
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
      const data = await fetchWithRetry(url);

      if (!data.values) {
        throw new Error("No data found in the sheet.");
      }

      // Process and deduplicate cases
      const uniqueCases = {};
      const allProducts = new Set();
      
      data.values.forEach((row) => {
        const caseId = row[0];
        
        if (!uniqueCases[caseId]) {
          const products = row[3] ? row[3].split(',')
            .map(p => p.trim())
            .map(p => cleanSKU(p))
            .filter(p => isValidSKU(p)) : [];
            
          uniqueCases[caseId] = {
            id: caseId,
            description: row[1],
            images: row[2] ? [row[2]] : [],
            products,
            decision: null
          };
          
          // Add products to set to avoid duplicates
          products.forEach(p => allProducts.add(p));
        } else if (row[2]) {
          uniqueCases[caseId].images.push(row[2]);
        }
      });

      const processedCases = Object.values(uniqueCases);
      
      // Update cache
      localStorage.setItem('qcFailureDataCache', JSON.stringify(processedCases));
      localStorage.setItem('qcFailureDataCacheTimestamp', Date.now().toString());
      
      setCases(processedCases);
      setLoading(false);
      return processedCases;
    } catch (error) {
      console.error("Error fetching data:", error);
      // Try to use cached data even if expired
      const cachedData = localStorage.getItem('qcFailureDataCache');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        setCases(parsedData);
        return parsedData;
      }
      setLoading(false);
      return [];
    }
  };

  const cleanSKU = (sku) => {
    // Remove any non-digit characters (including parentheses)
    return sku.replace(/\D/g, '');
  };

  const isValidSKU = (sku) => {
    // Clean the SKU first
    const cleanedSKU = cleanSKU(sku);
    // Check if it's exactly 9 digits and starts with 2
    return /^2\d{8}$/.test(cleanedSKU);
  };

  const normalizeBrandName = (brand) => {
    if (!brand) return '';
    // Remove special characters, extra spaces, and make lowercase
    return brand
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
      .trim();
  };

  const isLuxuryBrand = (brand) => {
    if (!brand) return false;
    const normalizedBrand = normalizeBrandName(brand);
    
    // Check if any luxury brand name is contained within the product brand name
    for (const luxuryBrand of luxuryBrands) {
      if (normalizedBrand.includes(luxuryBrand) || luxuryBrand.includes(normalizedBrand)) {
        return true;
      }
    }
    return false;
  };

  const handleDecisionChange = (caseId, decision) => {
    const currentDate = new Date().toISOString();
    // Get the user information from localStorage
    const userString = localStorage.getItem('user');
    let agentName = 'Unknown Agent';
    
    try {
      const user = JSON.parse(userString);
      agentName = user?.username || user?.name || user?.email || 'Unknown Agent';
    } catch (error) {
      console.error('Error parsing user information:', error);
    }
    
    setDecisions(prev => {
      const newDecisions = {
        ...prev,
        [caseId]: {
          status: decision,
          agent: agentName,
          date: currentDate
        }
      };
      // Save to localStorage
      localStorage.setItem('qcDecisions', JSON.stringify(newDecisions));
      return newDecisions;
    });
    setActiveCaseId(caseId);
    setShowWarning(false);
    setUndecidedCases(prev => prev.filter(id => id !== caseId));
  };

  const handleSubmitDecisions = () => {
    const newUndecidedCases = cases.filter(caseData => !decisions[caseData.id]).map(caseData => caseData.id);
    if (newUndecidedCases.length > 0) {
      setShowWarning(true);
      setUndecidedCases(newUndecidedCases);
      return;
    }
    setShowWarning(false);
    setUndecidedCases([]);
    setShowDecisions(true);
    setReviewInitiated(true);
  };

  const handleBackToCases = () => {
    setShowDecisions(false);
  };

  const handleExport = () => {
    // Get selected cases or all cases if none selected
    const casesToExport = selectedCases.size > 0 
      ? cases.filter(caseItem => selectedCases.has(caseItem.id))
      : cases;

    // Create data array for Excel
    const exportData = casesToExport.map(caseItem => {
      // Get all products for this case
      const products = caseItem.products.map(sku => {
        const url = getProductUrl(sku);
        const brand = brandNames[url] || '';
        const isLuxury = brand ? isLuxuryBrand(brand) : false;
        const decision = decisions[caseItem.id] || { status: 'Undecided', agent: 'N/A', date: 'N/A' };
        
        return {
          'Case Number': caseItem.id,
          'SKU': sku,
          'Brand Name': brand,
          'Brand Type': isLuxury ? 'Luxury' : 'Non-Luxury',
          'Decision': decision.status,
          'Agent': decision.agent,
          'Decision Date': decision.date ? new Date(decision.date).toLocaleString() : 'N/A'
        };
      });
      
      return products;
    }).flat();

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Case Number
      { wch: 12 }, // SKU
      { wch: 30 }, // Brand Name
      { wch: 12 }, // Brand Type
      { wch: 15 }, // Decision
      { wch: 20 }, // Agent
      { wch: 20 }, // Decision Date
    ];
    ws['!cols'] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'QC Failures');

    // Generate file name with current date
    const date = new Date().toISOString().split('T')[0];
    const fileName = `QC_Failures_${date}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  };

  const handleLinkClick = async (caseId, event, url) => {
    event.preventDefault();
    setActiveCaseId(caseId);
    
    try {
      // Only scrape if we haven't already
      if (!brandNames[url] || !productPrices[url]) {
        console.log('Fetching brand name and price for:', url);
        const { brand, price } = await scrapeBrandName(url);
        console.log('Received brand name and price:', brand, price);
        if (brand) {
          setBrandNames(prev => {
            const updated = {
              ...prev,
              [url]: brand
            };
            localStorage.setItem('brandNames', JSON.stringify(updated));
            return updated;
          });
        }
        if (price) {
          setProductPrices(prev => {
            const updated = {
              ...prev,
              [url]: price
            };
            localStorage.setItem('productPrices', JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (error) {
      console.error('Error in handleLinkClick:', error);
    }
    
    window.open(url, '_blank');
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allCaseIds = filteredCases.map(caseData => caseData.id);
      setSelectedCases(new Set(allCaseIds));
    } else {
      setSelectedCases(new Set());
    }
  };

  const handleCaseSelect = (caseId) => {
    setSelectedCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const navigateToNextUndecided = () => {
    if (undecidedCases.length === 0) return;
    const nextIndex = (currentUndecidedIndex + 1) % undecidedCases.length;
    setCurrentUndecidedIndex(nextIndex);
    const caseId = undecidedCases[nextIndex];
    caseRefs.current[caseId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const navigateToPrevUndecided = () => {
    if (undecidedCases.length === 0) return;
    const prevIndex = (currentUndecidedIndex - 1 + undecidedCases.length) % undecidedCases.length;
    setCurrentUndecidedIndex(prevIndex);
    const caseId = undecidedCases[prevIndex];
    caseRefs.current[caseId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const filteredCases = cases.filter(caseData => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      caseData.id.toLowerCase().includes(searchLower) ||
      caseData.description.toLowerCase().includes(searchLower) ||
      caseData.products.some(p => p.toLowerCase().includes(searchLower)) ||
      (decisions[caseData.id] && decisions[caseData.id].status?.toLowerCase().includes(searchLower))
    );

    if (showLuxuryOnly) {
      // Check if any product in the case has a luxury brand
      return matchesSearch && caseData.products.some(sku => {
        const url = getProductUrl(sku);
        const brand = brandNames[url];
        return brand && isLuxuryBrand(brand);
      });
    }

    return matchesSearch;
  });

  const getDecisionIcon = (decision) => {
    switch (decision) {
      case 'Approved':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'Rejected':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'Incorrectly Assigned':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  useEffect(() => {
    const fetchBrandsForCases = async () => {
      console.log('Fetching brands for cases:', cases);
      const allProducts = new Set();
      cases.forEach(caseItem => {
        caseItem.products?.forEach(p => allProducts.add(p));
      });
      
      if (allProducts.size > 0) {
        console.log('Found products:', [...allProducts]);
        await fetchBrandNames([...allProducts]);
      }
    };

    if (cases.length > 0) {
      fetchBrandsForCases();
    }
  }, [cases]); // Only run when cases change

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await Promise.all([
        fetchLuxuryBrands(),
        fetchData()
      ]);
      setLoading(false);
    };

    loadInitialData();

    // Add event listener for beforeunload
    const handleBeforeUnload = (e) => {
      const hasUndecidedCases = cases.some(caseItem => !decisions[caseItem.id]);
      
      if (hasUndecidedCases) {
        e.preventDefault();
        e.returnValue = 'You have undecided cases. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // Empty dependency array for initial load only

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QC Failure Cases</h1>
            <p className="mt-1 text-sm text-gray-500">
              Review and manage quality control failure cases
            </p>
            {showWarning && (
              <div className="mt-4 flex items-center gap-2 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-md">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Attention Required</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    {undecidedCases.length} {undecidedCases.length === 1 ? 'case requires' : 'cases require'} your decision before proceeding.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="w-64 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm
                    focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Search cases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowLuxuryOnly(!showLuxuryOnly)}
                className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm
                  font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                  ${showLuxuryOnly 
                    ? 'border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100' 
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
              >
                <FunnelIcon className="h-4 w-4 mr-1.5" />
                Luxury Only
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm
                  font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none
                  focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1.5 text-gray-500" />
                Export XLSX {selectedCases.size > 0 ? `(${selectedCases.size})` : ''}
              </button>
              <button
                onClick={showDecisions ? handleBackToCases : handleSubmitDecisions}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm
                  font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {showDecisions ? 'Back to Cases' : 'Review'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : showDecisions ? (
        // Decisions View
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={selectedCases.size === filteredCases.length}
                onChange={handleSelectAll}
              />
            </div>
            <div className="col-span-2">Case ID</div>
            <div className="col-span-6">Description</div>
            <div className="col-span-3">Decision</div>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredCases.map(caseData => (
              <div key={caseData.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedCases.has(caseData.id)}
                    onChange={() => handleCaseSelect(caseData.id)}
                  />
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {"0" + caseData.id}
                  </span>
                </div>
                <div className="col-span-6">
                  <div className="text-sm text-gray-900">{caseData.description}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {caseData.products.map((product, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {product}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-3">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                    ${decisions[caseData.id]?.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      decisions[caseData.id]?.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      decisions[caseData.id]?.status === 'Incorrectly Assigned' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    <span className="flex items-center">
                      {getDecisionIcon(decisions[caseData.id]?.status)}
                      <span className="ml-1.5">{decisions[caseData.id]?.status || 'Undecided'}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Cases View
        <div className="space-y-4">
          {undecidedCases.length > 0 && (
            <div className="fixed right-8 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-50">
              <button
                onClick={navigateToPrevUndecided}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ChevronUpIcon className="h-6 w-6 text-gray-600" />
              </button>
              <div className="text-center text-sm text-gray-600">
                {currentUndecidedIndex + 1}/{undecidedCases.length}
              </div>
              <button
                onClick={navigateToNextUndecided}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ChevronDownIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          )}
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
              checked={selectedCases.size === filteredCases.length}
              onChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600">
              Select All {selectedCases.size > 0 ? `(${selectedCases.size} selected)` : ''}
            </span>
          </div>
          {filteredCases.map(caseData => (
            <div 
              key={caseData.id} 
              ref={el => caseRefs.current[caseData.id] = el}
              onClick={() => setActiveCaseId(caseData.id)}
              className={`bg-white rounded-lg shadow-sm overflow-hidden border transition-all duration-200
                ${undecidedCases.includes(caseData.id) ? 'border-amber-400 bg-amber-50 shadow-amber-100' : 'border-gray-200'}
                ${activeCaseId === caseData.id ? 'ring-2 ring-indigo-500 shadow-md' : ''}
                cursor-pointer`}
            >
              <div className="p-6">
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3"
                          checked={selectedCases.has(caseData.id)}
                          onChange={() => handleCaseSelect(caseData.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">{"0" + caseData.id}</h3>
                          <p className="mt-1 text-sm text-gray-600">{caseData.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">SKUs</div>
                          <div className="text-xs text-gray-400">{caseData.products.length} items</div>
                        </div>
                        <div className="space-y-2">
                          {caseData.products.map((product, idx) => (
                            <div
                              key={idx}
                              className="flex items-center w-full"
                            >
                              <span className="text-gray-400 mr-2 flex-shrink-0 w-4">{idx + 1}.</span>
                              <div className="flex flex-col w-full space-y-1">
                                <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                                  <a
                                    href={getProductUrl(product)}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      window.open(getProductUrl(product), '_blank');
                                    }}
                                    className="flex items-center px-3 py-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-800 min-w-[90px]"
                                  >
                                    {product}
                                  </a>
                                  <div className="flex items-center flex-grow border-l border-gray-200">
                                    {brandNames[getProductUrl(product)] && (
                                      <div className="px-3 py-1.5 text-xs font-medium text-gray-600 border-r border-gray-200 flex-grow">
                                        {brandNames[getProductUrl(product)]}
                                      </div>
                                    )}
                                    {productPrices[getProductUrl(product)] && (
                                      <span className="px-3 py-1.5 text-xs font-semibold text-emerald-600 whitespace-nowrap">
                                        {productPrices[getProductUrl(product)]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Images</div>
                          <div className="text-xs text-gray-400">{caseData.images.length} items</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {caseData.images.map((image, idx) => (
                            <a
                              key={idx}
                              href={image}
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(image, '_blank');
                              }}
                              className="flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium
                                bg-indigo-50 text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
                            >
                              Image {idx + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 pl-4 border-l">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Action</div>
                    <div className="space-y-1">
                      {['Approved', 'Rejected', 'Incorrectly Assigned'].map((option) => (
                        <label
                          key={option}
                          className={`flex items-center p-1.5 rounded cursor-pointer
                            ${decisions[caseData.id]?.status === option
                              ? 'bg-indigo-50 text-indigo-900'
                              : 'hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                          <input
                            type="radio"
                            name={`action_${caseData.id}`}
                            value={option}
                            checked={decisions[caseData.id]?.status === option}
                            onChange={() => handleDecisionChange(caseData.id, option)}
                            className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                          />
                          <div className="ml-2 flex items-center">
                            {getDecisionIcon(option)}
                            <span className="ml-1.5 text-xs font-medium">{option}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QCFailure;
