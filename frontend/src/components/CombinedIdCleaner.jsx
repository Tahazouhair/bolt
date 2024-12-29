import React, { useState } from 'react';
import { DocumentDuplicateIcon, XCircleIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

const CombinedIdCleaner = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  const generateQueries = () => {
    setIsProcessing(true);
    setShowAnimation(true);
    
    // Split input by whitespace and filter out empty strings
    const idsArray = inputText.split(/[\s,]+/).filter(id => id.trim());
    
    setTimeout(() => {
      if (idsArray.length > 0) {
        // Calculate total number of batches
        const batchSize = 30;
        const numBatches = Math.ceil(idsArray.length / batchSize);
        setTotalBatches(numBatches);
        setCurrentBatch(1);

        // Generate first batch
        const batch = idsArray.slice(0, batchSize);
        const formattedIds = batch.map(id => `'${id}'`).join(', ');
        
        const query = `SELECT Id, ContentDocumentId
FROM ContentVersion
WHERE ContentDocumentId IN (
    ${formattedIds}
);`;
        
        setOutputText(query);
      } else {
        setOutputText('No IDs found.');
        setTotalBatches(0);
        setCurrentBatch(0);
      }
      
      setIsProcessing(false);
      setTimeout(() => setShowAnimation(false), 300);
    }, 500);
  };

  const showNextBatch = () => {
    const idsArray = inputText.split(/[\s,]+/).filter(id => id.trim());
    const batchSize = 30;
    const startIdx = currentBatch * batchSize;
    const batch = idsArray.slice(startIdx, startIdx + batchSize);
    const formattedIds = batch.map(id => `'${id}'`).join(', ');
    
    const query = `SELECT Id, ContentDocumentId
FROM ContentVersion
WHERE ContentDocumentId IN (
    ${formattedIds}
);`;
    
    setOutputText(query);
    setCurrentBatch(prev => prev + 1);
  };

  const showPreviousBatch = () => {
    const idsArray = inputText.split(/[\s,]+/).filter(id => id.trim());
    const batchSize = 30;
    const startIdx = (currentBatch - 2) * batchSize;
    const batch = idsArray.slice(startIdx, startIdx + batchSize);
    const formattedIds = batch.map(id => `'${id}'`).join(', ');
    
    const query = `SELECT Id, ContentDocumentId
FROM ContentVersion
WHERE ContentDocumentId IN (
    ${formattedIds}
);`;
    
    setOutputText(query);
    setCurrentBatch(prev => prev - 1);
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
    setCurrentBatch(0);
    setTotalBatches(0);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center mb-4">
          <ClipboardDocumentIcon className="h-8 w-8 text-indigo-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Combined ID Query Generator</h1>
        </div>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Generate SOQL queries for Content Version IDs. 
          Automatically splits large sets of IDs into batches of 30 for optimal performance.
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
              <h2 className="text-xl font-semibold text-gray-900">Input IDs</h2>
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
              rows={8}
              className="shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                border border-gray-300 rounded-lg transition-all duration-200
                placeholder-gray-400 resize-none hover:border-indigo-300"
              placeholder="Enter IDs separated by commas or new lines..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="mt-6">
              <button
                onClick={generateQueries}
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
                  'Generate Query'
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
              <div className="flex items-center space-x-2">
                {totalBatches > 1 && (
                  <div className="flex items-center space-x-2 mr-4">
                    <button
                      onClick={showPreviousBatch}
                      disabled={currentBatch <= 1}
                      className={`px-2 py-1 rounded-lg border ${currentBatch <= 1 
                        ? 'text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      ←
                    </button>
                    <span className="text-sm text-gray-500">
                      {currentBatch} / {totalBatches}
                    </span>
                    <button
                      onClick={showNextBatch}
                      disabled={currentBatch >= totalBatches}
                      className={`px-2 py-1 rounded-lg border ${currentBatch >= totalBatches 
                        ? 'text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      →
                    </button>
                  </div>
                )}
                <button
                  onClick={copyToClipboard}
                  disabled={!outputText || outputText === 'No IDs found.'}
                  className={`inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg
                    transition-all duration-200
                    ${!outputText || outputText === 'No IDs found.'
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
            </div>
            <textarea
              rows={12}
              className="font-mono shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                border border-gray-300 rounded-lg bg-gray-50 resize-none"
              value={outputText}
              readOnly
            />
            {outputText && outputText !== 'No IDs found.' && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-gray-500">
                  {totalBatches > 1 
                    ? `Showing batch ${currentBatch} of ${totalBatches}`
                    : 'Query generated successfully'}
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

export default CombinedIdCleaner;
