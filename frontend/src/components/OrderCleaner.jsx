import React, { useState } from 'react';
import { DocumentDuplicateIcon, XCircleIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

const OrderCleaner = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  const extractOrderNumbers = () => {
    setIsProcessing(true);
    setShowAnimation(true);
    
    // Regex for order numbers
    const orderNumbers = inputText.match(/\b(?:POS|POQ|POO|POB|POU|P3|P4|POK)\d+(?:-\d+)?\b/g);

    setTimeout(() => {
      if (orderNumbers) {
        // Remove duplicates
        const uniqueOrderNumbers = [...new Set(orderNumbers)];
        setOutputText(uniqueOrderNumbers.join(' , '));
      } else {
        setOutputText('No order numbers found.');
      }
      setIsProcessing(false);
      setTimeout(() => setShowAnimation(false), 300);
    }, 500);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert('Failed to copy order numbers.');
    }
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center mb-4">
          <ClipboardDocumentIcon className="h-8 w-8 text-indigo-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Order Number Cleaner</h1>
        </div>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          A powerful tool to extract and format order numbers from any text. 
          Supports POS, POQ, POO, POB, POU, P3, P4, and POK formats.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 relative">
        {/* Connecting Line */}
        <div className="hidden lg:block absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className={`h-20 w-0.5 bg-gradient-to-b from-indigo-500/0 via-indigo-500/30 to-indigo-500/0
            ${showAnimation ? 'animate-pulse' : ''}`} />
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Input Text</h2>
              <button
                onClick={clearAll}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg
                  text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <XCircleIcon className="h-4 w-4 mr-1.5 text-gray-500" />
                Clear
              </button>
            </div>
            <textarea
              id="inputText"
              rows={8}
              className="shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                border border-gray-300 rounded-lg transition-all duration-200
                placeholder-gray-400 resize-none hover:border-indigo-300"
              placeholder="Paste your text containing order numbers here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="mt-6">
              <button
                onClick={extractOrderNumbers}
                disabled={!inputText || isProcessing}
                className={`w-full inline-flex justify-center items-center px-6 py-3 border border-transparent
                  text-sm font-medium rounded-lg shadow-sm text-white transition-all duration-200
                  ${!inputText || isProcessing 
                    ? 'bg-indigo-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Processing...
                  </>
                ) : (
                  'Extract Order Numbers'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md
          ${showAnimation ? 'animate-pulse' : ''}`}>
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Extracted Numbers</h2>
              <button
                onClick={copyToClipboard}
                disabled={!outputText || outputText === 'No order numbers found.'}
                className={`inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg
                  transition-all duration-200
                  ${!outputText || outputText === 'No order numbers found.'
                    ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'text-gray-700 bg-white hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
              >
                <DocumentDuplicateIcon 
                  className={`h-4 w-4 mr-1.5 transition-colors duration-200 
                    ${copySuccess ? 'text-green-500' : 'text-gray-500'}`} 
                />
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              id="caseNumbersContainer"
              rows={8}
              className="shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                border border-gray-300 rounded-lg bg-gray-50 resize-none"
              value={outputText}
              readOnly
            />
            {outputText && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-gray-500">
                  {outputText === 'No order numbers found.' 
                    ? 'No order numbers were found in the input text.'
                    : `Found ${outputText.split(',').length} unique order number${outputText.split(',').length === 1 ? '' : 's'}.`
                  }
                </p>
                {outputText !== 'No order numbers found.' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {outputText.split(',').length} found
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderCleaner;
