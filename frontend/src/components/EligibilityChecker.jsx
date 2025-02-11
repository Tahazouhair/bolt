import React, { useState, useEffect, Fragment } from 'react';
import { DocumentDuplicateIcon, ExclamationTriangleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid';
import { GOOGLE_SHEETS_CONFIG } from '../config';

const EligibilityChecker = () => {
  const itemTypeOptions = [
    { id: 'own', name: 'Own' },
    { id: 'marketplace', name: 'Marketplace' },
  ]

  const damageNatureOptions = [
    { id: 'noEvidence', name: 'Medium – CCTV Available and Clear' },
    { id: 'indisputable', name: 'Medium – CCTV Unavailable or Unclear' },
    { id: 'heavy', name: 'Heavy Use' },
  ]

  const initialFormData = {
    itemType: itemTypeOptions[0].id,
    originalPrice: '',
    sellingPrice: '',
    cm3: '',
    exceptions: '',
    damageNature: damageNatureOptions[0].id,
    completionRate: '',
    totalSpend: '',
    isNewCustomer: false,
    sku: '',
    isItemTypeEditable: true,
    email: '',
    brandName: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [result, setResult] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [brandNames, setBrandNames] = useState(() => {
    const cached = localStorage.getItem('brandNames');
    return cached ? JSON.parse(cached) : {};
  });
  const [luxuryBrands, setLuxuryBrands] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [emailMatch, setEmailMatch] = useState(null);
  const [emailCount, setEmailCount] = useState(0);
  const [totalExceptionValue, setTotalExceptionValue] = useState(0);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.QC_SHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.BRANDS_RANGE}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.values) {
        const brands = new Set();
        data.values.forEach(row => {
          // Using only the first (and only) column for Marketplace brands
          if (row[0]) brands.add(normalizeBrandName(row[0]));
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

  const normalizeBrandName = (brand) => {
    if (!brand) return '';
    return brand
      .trim()
      .toLowerCase()
      // Remove anything in parentheses including the parentheses
      .replace(/\s*\([^)]*\)/g, '')
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove special characters and punctuation except spaces
      .replace(/[^\w\s]/g, '')
      // Final trim to remove any leading/trailing spaces
      .trim();
  };

  const isLuxuryBrand = (brandName) => {
    if (!brandName) return false;
    const normalizedInput = normalizeBrandName(brandName);
    // Convert Set to Array, normalize each brand name, and check if any match
    return [...luxuryBrands].some(brand => 
      normalizeBrandName(brand) === normalizedInput
    );
  };

  useEffect(() => {
    fetchLuxuryBrands();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'cm3' || name === 'totalSpend' || name === 'sellingPrice') {
      // Remove any non-numeric characters except decimal point
      const numericValue = value.replace(/[^\d.]/g, '');
      
      // For cm3, totalSpend, and sellingPrice, format with commas for thousands
      if ((name === 'cm3' || name === 'totalSpend' || name === 'sellingPrice') && numericValue) {
        const formatted = parseFloat(numericValue).toLocaleString('en-US', {
          maximumFractionDigits: 0,
          minimumFractionDigits: 0
        });
        setFormData((prev) => ({
          ...prev,
          [name]: formatted,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: numericValue,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }

    // Handle SKU input and brand name retrieval
    if (name === 'sku' && value) {
      handleSkuChange(value);
    }

    // New Customer checkbox handling
    if (name === 'isNewCustomer') {
      setIsNewCustomer(checked);
    }

    // Remove yellow highlight when field is filled
    if (value) {
      const input = document.getElementById(name);
      if (input) {
        input.classList.remove('bg-yellow-50', 'border-yellow-300');
      }
    }
  };

  const handleClear = () => {
    setFormData(initialFormData);
    setResult(null);
    setEmailCount(0);
    setTotalExceptionValue(0);
    
    // Remove highlights from any fields that might have them
    const requiredFields = ['itemType', 'originalPrice', 'cm3', 'damageNature', 'completionRate', 'totalSpend', 'sku', 'email'];
    requiredFields.forEach(field => {
      const input = document.getElementById(field);
      if (input) {
        input.classList.remove('bg-yellow-50', 'border-yellow-300');
      }
    });
  };

  const copyResults = () => {
    const resultText = document.getElementById('resultContent').innerText;
    navigator.clipboard.writeText(resultText).then(() => {
      const copyButton = document.querySelector('.copy-button');
      copyButton.textContent = 'Copied!';
      copyButton.classList.add('bg-green-500');
      setTimeout(() => {
        copyButton.textContent = 'Copy';
        copyButton.classList.remove('bg-green-500');
      }, 2000);
    });
  };

  const handleCopy = () => {
    const resultText = `
Refund Eligibility Results:
------------------------
Final Decision: ${result.finalDecision}
Customer Type: ${result.customerType}
Completion Rate: ${result.completionRate}%
Nature: ${result.damageNature}
Exceptions Used: ${result.exceptionsUsed}
Item Type: ${result.itemType}
Original Price: ${result.originalPrice} AED
Selling Price: ${result.sellingPrice} AED
COGS: ${result.cogs}
COGS Coverage: ${result.cogsCoverage}
Requires COGS Coverage: ${result.requiresCogsCoverage}
`.trim();

    navigator.clipboard.writeText(resultText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const checkEligibility = (e) => {
    e.preventDefault();
    setValidationError('');

    // Check if all required fields are filled
    const requiredFields = ['itemType', 'originalPrice', 'sellingPrice', 'cm3', 'damageNature', 'completionRate', 'totalSpend', 'sku', 'email'];
    const emptyFields = requiredFields.filter(field => {
      const value = formData[field];
      return value === undefined || value === null || value === '' || (typeof value === 'string' && value.trim() === '');
    });

    if (emptyFields.length > 0) {
      // Add yellow highlight to empty required fields
      requiredFields.forEach(field => {
        const input = document.getElementById(field);
        if ((!formData[field] || formData[field] === '') && input) {
          input.classList.add('bg-yellow-50', 'border-yellow-300');
        } else if (input) {
          input.classList.remove('bg-yellow-50', 'border-yellow-300');
        }
      });
      return;
    }

    // Remove highlights when all fields are filled
    requiredFields.forEach(field => {
      const input = document.getElementById(field);
      if (input) {
        input.classList.remove('bg-yellow-50', 'border-yellow-300');
      }
    });

    const {
      itemType,
      originalPrice,
      sellingPrice,
      cm3,
      damageNature,
      completionRate,
      totalSpend,
      isNewCustomer,
      sku,
      email,
    } = formData;

    const numericValues = {
      originalPrice: parseFloat(originalPrice.toString().replace(/[^\d.-]/g, '')),
      sellingPrice: parseFloat(sellingPrice.toString().replace(/[^\d.-]/g, '')),
      cm3: parseFloat(cm3.toString().replace(/[^\d.-]/g, '')),
      completionRate: parseFloat(completionRate),
      totalSpend: parseFloat(totalSpend.toString().replace(/[^\d.-]/g, '')),
    };

    if (Object.values(numericValues).some(isNaN)) {
      setResult({
        error: true,
        message: 'Please fill in all fields correctly.',
      });
      return;
    }

    const cogs = itemType === 'own' ? numericValues.originalPrice * 0.4 : numericValues.originalPrice * 0.7;
    let customerType = '';
    const cogsCoverage = numericValues.cm3 >= cogs ? 'CM3 covers COGS' : 'CM3 does not cover COGS';
    let requiresCogsCoverage = 'Yes';
    const calculatedCogs = `${cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;
    const refundDifference = 2700 - cogs;

    if (isNewCustomer) {
      customerType = 'New Customer';
    } else if (numericValues.totalSpend > 100000 && numericValues.completionRate >= 55) {
      customerType = 'Elite';
    } else if (numericValues.totalSpend >= 20000 && numericValues.totalSpend <= 100000 && numericValues.completionRate >= 65) {
      customerType = 'Excellent';
    } else if (numericValues.totalSpend > 50000 && numericValues.completionRate > 25) {
      customerType = 'Regular Above 50K';
    } else if (numericValues.totalSpend < 20000 && numericValues.completionRate >= 70) {
      customerType = 'Good';
    } else if (numericValues.totalSpend <= 50000 && numericValues.completionRate > 25) {
      customerType = 'Regular Below 50K';
    } else {
      customerType = 'Not Eligible - Completion Rate Requirements Not Met';
    }

    let eligibility = 'Not Eligible';
    let finalDecision = 'Refund Denied - Not Eligible';
    let calculatedRefund = 'N/A';
    let textColor = 'text-red-600';

    if (numericValues.sellingPrice > 2700) {
      eligibility = 'Not Eligible';
      finalDecision = 'Refund Denied - Selling Price exceeds 2700 AED limit';
    } else if (customerType !== 'Not Eligible - Completion Rate Requirements Not Met' && refundDifference > 0) {
      if (customerType === 'Elite') {
        requiresCogsCoverage = 'No';
        if (damageNature === 'indisputable') {
          if (emailCount < 3) {
            eligibility = 'Eligible';
            finalDecision = `Refund Approved - ${3 - emailCount} exceptions remaining for indisputable evidence`;
            calculatedRefund = `${refundDifference.toFixed(2)} AED`;
            textColor = 'text-green-600';
            requiresCogsCoverage = 'No';
          } else {
            eligibility = 'Not Eligible';
            finalDecision = 'Refund Denied - Maximum exceptions (3) used for indisputable evidence';
          }
        } else {
          requiresCogsCoverage = 'Yes';
          if (numericValues.cm3 >= cogs) {
            if (emailCount < 1) {
              eligibility = 'Eligible';
              finalDecision = `Refund Approved - CM3 covers COGS for ${damageNature} case`;
              calculatedRefund = `${refundDifference.toFixed(2)} AED`;
              textColor = 'text-green-600';
            } else {
              eligibility = 'Not Eligible';
              finalDecision = 'Refund Denied - No more Exceptions left';
            }
          } else {
            eligibility = 'Not Eligible';
            finalDecision = `Refund Denied - CM3 (${numericValues.cm3} AED) insufficient to cover COGS (${cogs.toFixed(2)} AED)`;
          }
        }
      } else if (customerType === 'Excellent') {
        requiresCogsCoverage = 'No';
        if (damageNature === 'indisputable') {
          if (emailCount < 2) {
            eligibility = 'Eligible';
            finalDecision = `Refund Approved - ${2 - emailCount}/2 exceptions remaining for Unclear CCTV`;
            calculatedRefund = `${refundDifference.toFixed(2)} AED`;
            textColor = 'text-green-600';
          } else {
            eligibility = 'Not Eligible';
            finalDecision = 'Refund Denied - Exception limit reached (2 max)';
          }
        } else {
          requiresCogsCoverage = 'Yes';
          if (numericValues.cm3 >= cogs) {
            if (emailCount < 1) {
              eligibility = 'Eligible';
              finalDecision = 'Refund Approved - CM3 covers COGS';
              calculatedRefund = `${refundDifference.toFixed(2)} AED`;
              textColor = 'text-green-600';
            } else {
              eligibility = 'Not Eligible';
              finalDecision = 'Refund Denied - No exceptions remaining';
            }
          } else {
            eligibility = 'Not Eligible';
            finalDecision = `Refund Denied - CM3 insufficient by ${(cogs - numericValues.cm3).toFixed(2)} AED`;
          }
        }
      } else if (customerType === 'Good') {
        requiresCogsCoverage = 'Yes';
        if (damageNature === 'heavy') {
          eligibility = 'Not Eligible';
          finalDecision = 'Refund Denied - Good customer - No approvals for heavy use cases';
        } else {
          if (numericValues.cm3 >= cogs) {
            if (emailCount < 1) {
              eligibility = 'Eligible';
              finalDecision = `Refund Approved - One-time exception`;
              calculatedRefund = `${refundDifference.toFixed(2)} AED`;
              textColor = 'text-green-600';
            } else {
              eligibility = 'Not Eligible';
              finalDecision = 'Refund Denied - Good customer exception already used';
            }
          } else {
            eligibility = 'Not Eligible';
            finalDecision = `Refund Denied - CM3 short by ${(cogs - numericValues.cm3).toFixed(2)} AED`;
          }
        }
      } else if (customerType === 'New Customer') {
        requiresCogsCoverage = 'Yes';
        if (damageNature === 'heavy') {
          finalDecision = 'Refund Denied - No exceptions allowed for Heavy Use';
        } else {
          if (numericValues.cm3 >= cogs) {
            if (emailCount < 1) {
              eligibility = 'Eligible';
              finalDecision = 'Refund Approved - CM3 coverage with valid exception';
              calculatedRefund = `${refundDifference.toFixed(2)} AED`;
              textColor = 'text-green-600';
            } else {
              eligibility = 'Not Eligible';
              finalDecision = 'Refund Denied - Exceeded exception limit';
            }
          } else {
            eligibility = 'Not Eligible';
            finalDecision = 'Refund Denied - CM3 does not cover COGS';
          }
        }
      } else if (customerType === 'Regular Above 50K') {
        requiresCogsCoverage = 'Yes';
        if (numericValues.cm3 >= cogs) {
          if (emailCount < 1) {
            eligibility = 'Eligible';
            finalDecision = 'Refund Approved - CM3 coverage with valid exception';
            calculatedRefund = `${refundDifference.toFixed(2)} AED`;
            textColor = 'text-green-600';
          } else {
            eligibility = 'Not Eligible';
            finalDecision = 'Refund Denied - Exceeded exception limit';
          }
        } else {
          eligibility = 'Not Eligible';
          finalDecision = 'Refund Denied - CM3 does not cover COGS';
        }
      } else if (customerType === 'Regular Below 50K') {
        requiresCogsCoverage = 'Yes';
        if (damageNature === 'indisputable') {
          if (numericValues.cm3 >= cogs) {
            if (emailCount < 1) {
              eligibility = 'Eligible';
              finalDecision = 'Refund Approved - CM3 coverage with valid exception';
              calculatedRefund = `${refundDifference.toFixed(2)} AED`;
              textColor = 'text-green-600';
            } else {
              eligibility = 'Not Eligible';
              finalDecision = 'Refund Denied - Exceeded exception limit';
            }
          } else {
            eligibility = 'Not Eligible';
            finalDecision = 'Refund Denied - CM3 does not cover COGS';
          }
        } else {
          finalDecision = `Refund Denied - No exceptions allowed for ${damageNature === 'heavy' ? 'Heavy Use' : damageNature === 'noEvidence' ? 'CCTV Available and Clear' : 'CCTV Unavailable or Unclear'}`;
        }
      }
    } else if (refundDifference <= 0) {
      finalDecision = 'Refund Denied - COGS exceeds 2700 AED limit';
    }

    const displayDamageNature = damageNature === 'noEvidence'
      ? 'Medium – CCTV Available and Clear'
      : damageNature === 'indisputable'
        ? 'Medium – CCTV Unavailable or Unclear'
        : 'Heavy Use';

    setResult({
      eligibility,
      customerType,
      completionRate: numericValues.completionRate,
      damageNature: displayDamageNature,
      exceptionsUsed: emailCount,
      itemType: itemType === 'own' ? 'Own' : 'Marketplace',
      originalPrice: `${parseFloat(numericValues.originalPrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AED`,
      sellingPrice: numericValues.sellingPrice.toFixed(2),
      cogs: calculatedCogs,
      cogsCoverage,
      requiresCogsCoverage,
      finalDecision,
      textColor,
      calculatedRefund,
    });
  };

  const handleSkuChange = async (sku) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/scrape-brand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: `https://ounass.ae/${sku}.html` }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.brand) {
        setBrandNames(prev => {
          const updated = { ...prev, [sku]: data.brand };
          localStorage.setItem('brandNames', JSON.stringify(updated));
          return updated;
        });
        
        // Update form data with brand and original price
        setFormData(prev => ({
          ...prev,
          brandName: data.brand,
          originalPrice: data.price || prev.originalPrice,
          itemType: isLuxuryBrand(data.brand) ? 'marketplace' : 'own',
          isItemTypeEditable: false
        }));
      }
    } catch (error) {
      console.error('Error fetching brand:', error);
      // Make Item Type editable when brand fetch fails
      setFormData(prev => ({
        ...prev,
        isItemTypeEditable: true
      }));
    } finally {
      setLoading(false);
    }
  };

  const fetchExceptionLimitEmails = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.QC_SHEET_ID}/values/ExceptionLimit!A2:B?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.values) {
        const emailCounts = {};
        const emailValues = {};
        data.values.forEach(row => {
          const email = row[0];
          const value = parseFloat(row[1]) || 0;
          if (email) {
            emailCounts[email] = (emailCounts[email] || 0) + 1;
            // Maintain numeric value for calculation
            emailValues[email] = (emailValues[email] || 0) + value;
          }
        });
        return { emailCounts, emailValues };
      } else {
        console.error("Error fetching exception limit emails: Data values not found");
        return { emailCounts: {}, emailValues: {} };
      }
    } catch (error) {
      console.error("Error fetching exception limit emails:", error);
      return { emailCounts: {}, emailValues: {} };
    }
  };

  const checkEmailMatch = async (emailToCheck) => {
    if (!emailToCheck) {
      setEmailMatch(null);
      setEmailCount(0);
      setTotalExceptionValue(0);
      return;
    }

    const { emailCounts, emailValues } = await fetchExceptionLimitEmails();
    const match = emailToCheck in emailCounts;
    
    // Set email match and count
    setEmailMatch(match);
    setEmailCount(match ? emailCounts[emailToCheck] : 0);
    
    // Set total exception value, maintaining numeric value for calculations
    const exceptionValue = match ? emailValues[emailToCheck] : 0;
    setTotalExceptionValue(exceptionValue);
  };

  const handleEmailChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, email: value }));
    checkEmailMatch(value);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Title Section */}
      <div className="mb-10">
        <div className="flex items-center mb-4">
          <DocumentTextIcon className="h-8 w-8 text-indigo-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Refund Eligibility Calculator</h1>
        </div>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Calculate refund eligibility based on customer data and item details. Supports various customer types and damage natures.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Calculator Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
          <div className="p-8">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Refund Eligibility Calculator
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Calculate refund eligibility based on customer data and item details.
            </p>

            <form onSubmit={checkEligibility} className="mt-5">
              <div className="mt-4">
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="itemType" className="block text-sm font-medium text-gray-700">
                    Item Type
                  </label>
                  <div className="mt-1">
                    <Listbox 
                      value={formData.itemType} 
                      onChange={(value) => handleInputChange({ target: { name: 'itemType', value } })}
                      disabled={!formData.isItemTypeEditable || !formData.sku}
                    >
                      {({ open }) => (
                        <>
                          <div className="relative mt-1">
                            <Listbox.Button 
                              id="itemType"
                              className={`relative w-full cursor-${formData.isItemTypeEditable && formData.sku ? 'default' : 'not-allowed'} rounded-md border ${!formData.itemType ? 'bg-yellow-50 border-yellow-300' : formData.isItemTypeEditable && formData.sku ? 'border-gray-300 bg-white' : 'border-gray-300 bg-gray-50'} py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm`}
                            >
                              <span className="block truncate">{itemTypeOptions.find(option => option.id === formData.itemType)?.name}</span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                              </span>
                            </Listbox.Button>
                            <Transition
                              show={open}
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                {itemTypeOptions.map((option) => (
                                  <Listbox.Option
                                    key={option.id}
                                    className={({ active }) =>
                                      classNames(
                                        active ? 'bg-indigo-600 text-white' : 'text-gray-900',
                                        'relative cursor-default select-none py-2 pl-8 pr-4'
                                      )
                                    }
                                    value={option.id}
                                  >
                                    {({ selected }) => (
                                      <>
                                        <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                          {option.name}
                                        </span>
                                        {selected ? (
                                          <span className={`absolute inset-y-0 left-0 flex items-center pl-1.5 text-indigo-600`}>
                                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                          </span>
                                        ) : null}
                                      </>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </>
                      )}
                    </Listbox>
                  </div>
                </div>

                <div>
                  <label htmlFor="originalPrice" className="block text-sm font-medium text-gray-700">
                    Original Price
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      id="originalPrice"
                      name="originalPrice"
                      value={formData.originalPrice}
                      disabled
                      className="relative w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-100 py-2 pl-3 pr-16 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Original price"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-sm text-gray-500">AED</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="cm3" className="block text-sm font-medium text-gray-700">
                    CM3 Value
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      name="cm3"
                      id="cm3"
                      value={formData.cm3}
                      onChange={handleInputChange}
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-16 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter CM3 value"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-sm text-gray-500">AED</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="exceptions" className="block text-sm font-medium text-gray-700">
                    Exceptions Used
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="exceptions"
                      id="exceptions"
                      value={emailCount}
                      readOnly
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Exceptions used"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="exceptionValue" className="block text-sm font-medium text-gray-700">
                    Exception Value
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      name="exceptionValue"
                      id="exceptionValue"
                      value={totalExceptionValue}
                      readOnly
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-16 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Exception Value"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-sm text-gray-500">AED</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="damageNature" className="block text-sm font-medium text-gray-700">
                    Nature
                  </label>
                  <div className="mt-1">
                    <Listbox value={formData.damageNature} onChange={(value) => handleInputChange({ target: { name: 'damageNature', value } })}>
                      {({ open }) => (
                        <>
                          <div className="relative mt-1">
                            <Listbox.Button 
                              id="damageNature"
                              className={`relative w-full cursor-default rounded-md border ${!formData.damageNature ? 'bg-yellow-50 border-yellow-300' : 'border-gray-300 bg-white'} py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm`}
                            >
                              <span className="block truncate">{damageNatureOptions.find(option => option.id === formData.damageNature)?.name}</span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                              </span>
                            </Listbox.Button>
                            <Transition
                              show={open}
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                {damageNatureOptions.map((option) => (
                                  <Listbox.Option
                                    key={option.id}
                                    className={({ active }) =>
                                      classNames(
                                        active ? 'bg-indigo-600 text-white' : 'text-gray-900',
                                        'relative cursor-default select-none py-2 pl-8 pr-4'
                                      )
                                    }
                                    value={option.id}
                                  >
                                    {({ selected }) => (
                                      <>
                                        <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                          {option.name}
                                        </span>
                                        {selected ? (
                                          <span className={`absolute inset-y-0 left-0 flex items-center pl-1.5 text-indigo-600`}>
                                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                          </span>
                                        ) : null}
                                      </>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </>
                      )}
                    </Listbox>
                  </div>
                </div>

                <div>
                  <label htmlFor="completionRate" className="block text-sm font-medium text-gray-700">
                    Completion Rate (%)
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="completionRate"
                      id="completionRate"
                      value={formData.completionRate}
                      onChange={handleInputChange}
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter completion rate"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="totalSpend" className="block text-sm font-medium text-gray-700">
                    Total Spend
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      name="totalSpend"
                      id="totalSpend"
                      value={formData.totalSpend}
                      onChange={handleInputChange}
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-16 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter total spend"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-sm text-gray-500">AED</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="sellingPrice" className="block text-sm font-medium text-gray-700">
                    Selling Price
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      name="sellingPrice"
                      id="sellingPrice"
                      value={formData.sellingPrice}
                      onChange={handleInputChange}
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-16 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter selling price"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-sm text-gray-500">AED</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                    SKU
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      name="sku"
                      id="sku"
                      value={formData.sku}
                      onChange={handleInputChange}
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter SKU"
                    />
                    {loading && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-sm text-gray-500">Loading...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="brandName" className="block text-sm font-medium text-gray-700">
                    Brand Name
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      id="brandName"
                      name="brandName"
                      value={formData.brandName || brandNames[formData.sku] || ''}
                      readOnly
                      className="relative w-full cursor-text rounded-md border border-gray-300 bg-gray-50 py-2 pl-3 pr-3 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Brand name will appear here"
                    />
                    {formData.brandName && isLuxuryBrand(formData.brandName) && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-sm text-blue-600 font-medium">MP</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="mt-1">
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={handleEmailChange}
                      className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-3 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter email"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="newCustomer"
                        name="isNewCustomer"
                        type="checkbox"
                        checked={formData.isNewCustomer}
                        onChange={handleInputChange}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="newCustomer" className="font-medium text-gray-700">
                        New Customer
                      </label>
                      <p className="text-gray-500">Check if the customer is new.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 sm:col-span-2">
                  <div className="flex items-center space-x-4">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap"
                    >
                      Calculate Eligibility
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap"
                    >
                      Clear Form
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Results Section - Sticky */}
        <div className="lg:sticky lg:top-12 lg:self-start">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  Eligibility Results
                </h3>
                {result && (
                  <button
                    onClick={handleCopy}
                    className={`inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg
                      transition-all duration-200
                      ${copySuccess ? 'bg-green-50 text-green-700 border-green-500' : 'text-gray-700 bg-white hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                  >
                    <ClipboardDocumentIcon className={`h-4 w-4 mr-1.5 ${copySuccess ? 'text-green-500' : 'text-gray-500'}`} />
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="mt-5">
                {!result ? (
                  <div className="text-sm text-gray-500">
                    Enter the required information and click Calculate Eligibility to see results
                  </div>
                ) : (
                  <div className="border-t border-gray-200">
                    <dl className="divide-y divide-gray-200">
                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Final Decision</dt>
                        <dd className={`text-sm ${result.textColor || 'text-gray-900'}`}>
                          {result.finalDecision}
                        </dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Customer Type</dt>
                        <dd className="text-sm text-gray-900">{result.customerType}</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Completion Rate</dt>
                        <dd className="text-sm text-gray-900">{result.completionRate}%</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Nature</dt>
                        <dd className="text-sm text-gray-900">{result.damageNature}</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Exceptions Used</dt>
                        <dd className="text-sm text-gray-900">{emailCount}</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Item Type</dt>
                        <dd className="text-sm text-gray-900">{result.itemType}</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Original Price</dt>
                        <dd className="text-sm text-gray-900">{formData.originalPrice} AED</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">COGS</dt>
                        <dd className="text-sm text-gray-900">{result.cogs}</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">COGS Coverage</dt>
                        <dd className="text-sm text-gray-900">{result.cogsCoverage}</dd>
                      </div>

                      <div className="px-4 py-2 sm:px-6 grid grid-cols-2 gap-2">
                        <dt className="text-sm font-medium text-gray-500">Requires COGS Coverage</dt>
                        <dd className="text-sm text-gray-900">{result.requiresCogsCoverage}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
  }
};

export default EligibilityChecker;
