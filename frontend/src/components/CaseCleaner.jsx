import React, { useState } from 'react';
import { DocumentDuplicateIcon, XCircleIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

const CaseCleaner = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  const extractAndGenerateQuery = () => {
    setIsProcessing(true);
    setShowAnimation(true);
    
    // Process text in chunks to handle large inputs
    const chunkSize = 1000;
    let caseNumbers = [];
    
    for (let i = 0; i < inputText.length; i += chunkSize) {
      const chunk = inputText.slice(i, i + chunkSize);
      const chunkCaseNumbers = chunk.match(/\b(02|03|04|05)\d{6,}\b/g);
      if (chunkCaseNumbers) {
        caseNumbers = caseNumbers.concat(chunkCaseNumbers);
      }
    }

    setTimeout(() => {
      if (caseNumbers.length > 0) {
        // Remove duplicates
        const uniqueCaseNumbers = [...new Set(caseNumbers)];
        
        // Format case numbers into SQL query
        const caseIdsPerLine = 7;
        let caseIdsString = '';
        for (let i = 0; i < uniqueCaseNumbers.length; i += caseIdsPerLine) {
          const ids = uniqueCaseNumbers.slice(i, i + caseIdsPerLine).map(id => `'${id}'`).join(', ');
          caseIdsString += '    ' + ids + ',\n';
        }
        caseIdsString = caseIdsString.trim().replace(/,$/, '');

        const query = `SELECT Id, CaseNumber, Description, Status, OwnerId,
    (SELECT Id, Title FROM CombinedAttachments)
FROM Case
WHERE CaseNumber IN (
${caseIdsString}
);`;

        setOutputText(query);
      } else {
        setOutputText('No case numbers found.');
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
      alert('Failed to copy query.');
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
          <h1 className="text-3xl font-bold text-gray-900">Case Query Generator</h1>
        </div>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Extract case numbers and generate a Salesforce SOQL query. 
          Supports case numbers starting with 02, 03, 04, or 05 followed by 6 or more digits.
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
              placeholder="Paste your text containing case numbers here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="mt-6">
              <button
                onClick={extractAndGenerateQuery}
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
                  'Generate SOQL Query'
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
              <h2 className="text-xl font-semibold text-gray-900">Generated Query</h2>
              <button
                onClick={copyToClipboard}
                disabled={!outputText || outputText === 'No case numbers found.'}
                className={`inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg
                  transition-all duration-200
                  ${!outputText || outputText === 'No case numbers found.'
                    ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'text-gray-700 bg-white hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
              >
                <DocumentDuplicateIcon 
                  className={`h-4 w-4 mr-1.5 transition-colors duration-200 
                    ${copySuccess ? 'text-green-500' : 'text-gray-500'}`} 
                />
                {copySuccess ? 'Copied!' : 'Copy Query'}
              </button>
            </div>
            <textarea
              id="queryOutput"
              rows={12}
              className="font-mono shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                border border-gray-300 rounded-lg bg-gray-50 resize-none"
              value={outputText}
              readOnly
            />
            {outputText && outputText !== 'No case numbers found.' && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-gray-500">
                  Query generated with unique case numbers
                </p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  SOQL Query
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseCleaner;
