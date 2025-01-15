import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { utils, writeFile } from 'xlsx';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

const CaseOverview = ({ initialFilter }) => {
    const [cases, setCases] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [pageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCases, setSelectedCases] = useState(new Set());
    const [teams, setTeams] = useState([]);
    const [filters, setFilters] = useState({
        assigned: initialFilter === 'assigned',
        unassigned: initialFilter === 'unassigned',
        otherQueues: initialFilter === 'other-qs',
        myOpenCases: initialFilter === 'my-cases',
        highPriority: initialFilter === 'high-priority',
        duplicates: initialFilter === 'duplicates',
        caseAssignment: initialFilter === 'case-assignment',
        internalFeedback: true // default to true
    });
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [tier2Members, setTier2Members] = useState([]);
    const [supportMembers, setSupportMembers] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [selectedAgent, setSelectedAgent] = useState('');
    const POLLING_INTERVAL = 30000; // Poll every 30 seconds

    const sheetId = process.env.REACT_APP_CASES_SHEET_ID;
    const apiKey = process.env.REACT_APP_API_KEY;
    const range = 'Unassigned Cases!A1:M';

    const otherQueuesList = [
        'LM Riyadh',
        'WareHouse_Al_Quoz',
        'WareHouse - DIP',
        'Courier DPT Special',
        'Last Mile UAE Internal',
        'Courier DPT',
        'KSA ECOM PROCESSING',
        'Digital Operations',
        'Last Mile UAE',
        'KSA ECOM RETURN',
        'WareHouse - Riyadh',
        'LM Jeddah',
        'LM Dammam'
    ];

    const priorityList = ['3 Hour', 'Same day', '2 Hour'];

    useEffect(() => {
        // Get current user from localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCurrentUser(user);
                
                // If initialFilter is my-cases, set the filter after user is loaded
                if (initialFilter === 'my-cases') {
                    setFilters(prev => ({
                        ...Object.fromEntries(Object.keys(prev).map(key => [key, false])),
                        myOpenCases: true
                    }));
                }
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }
    }, [initialFilter]);

    // Handle other initial filters
    useEffect(() => {
        if (initialFilter && initialFilter !== 'my-cases') {
            const filterKey = initialFilter === 'other-qs' 
                ? 'otherQueues' 
                : initialFilter === 'high-priority'
                ? 'highPriority'
                : initialFilter === 'duplicates'
                ? 'duplicates'
                : initialFilter === 'case-assignment'
                ? 'caseAssignment'
                : initialFilter;
                
            setFilters(prev => ({
                ...Object.fromEntries(Object.keys(prev).map(key => [key, false])),
                [filterKey]: true
            }));
            
            // Reset selected agent when view changes
            setSelectedAgent('');
        }
    }, [initialFilter]);

    useEffect(() => {
        fetchData();
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/teams`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            setTeams(response.data);
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    const getUserTeam = (username) => {
        if (!username || !teams.length) return null;
        
        const userTeam = teams.find(team => {
            // Check if user is in team members
            const isMember = team.members?.some(member => member.username === username);
            // Check if user is in manual members for departments
            const isManualMember = team.is_department && team.manual_members?.split(',').map(m => m.trim()).includes(username);
            return isMember || isManualMember;
        });

        if (userTeam) {
            return {
                name: userTeam.name,
                isDepartment: userTeam.is_department
            };
        }
        return null;
    };

    // Fetch team members
    useEffect(() => {
        const fetchTeamMembers = async () => {
            try {
                const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/teams`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                // Find Tier 2 team
                const tier2Team = response.data.find(team => team.name === 'Tier 2');
                if (tier2Team) {
                    const tier2Usernames = tier2Team.members.map(member => member.username);
                    setTier2Members(tier2Usernames);
                }

                // Find Support team (could be a department)
                const supportTeam = response.data.find(team => 
                    team.name === 'Support' || 
                    (team.name === 'Support Department' && team.is_department)
                );
                
                if (supportTeam) {
                    let supportUsernames = [];
                    if (supportTeam.is_department && supportTeam.manual_members) {
                        // For departments, get usernames from manual_members
                        supportUsernames = supportTeam.manual_members.split(',').map(name => name.trim());
                    } else {
                        // For regular teams, get usernames from members array
                        supportUsernames = supportTeam.members.map(member => member.username);
                    }
                    setSupportMembers(supportUsernames);
                }
            } catch (error) {
                console.error('Error fetching team members');
            }
        };

        fetchTeamMembers();
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            // Always fetch fresh data first
            await fetchData();
            
            // Set up polling for updates
            const intervalId = setInterval(async () => {
                await fetchData(true); // true flag for background update
            }, POLLING_INTERVAL);

            // Cleanup interval on unmount
            return () => clearInterval(intervalId);
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        // Load cached data on mount
        const cachedData = localStorage.getItem('caseOverviewData');
        const cachedTimestamp = localStorage.getItem('caseOverviewTimestamp');
        
        if (cachedData && cachedTimestamp) {
            const timestamp = parseInt(cachedTimestamp);
            const now = Date.now();
            // Use cached data if it's less than 5 minutes old
            if (now - timestamp < 5 * 60 * 1000) {
                setCases(JSON.parse(cachedData));
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!filters.duplicates && !filters.assigned) {
            setSelectedAgent('');
        }
    }, [filters.duplicates, filters.assigned]);

    useEffect(() => {
        // Reset selected agent when switching between duplicates and other views
        if (filters.duplicates) {
            setSelectedAgent('');
        }
    }, [filters.duplicates]);

    const isWithinLast24Hours = (dateStr) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        return diffInHours <= 24;
    };

    const hasTier2Comments = (comments) => {
        return comments.some(comment => tier2Members.includes(comment.by));
    };

    const hasRecentTier2Comments = (comments) => {
        return comments.some(comment => 
            tier2Members.includes(comment.by) && 
            isWithinLast24Hours(comment.date)
        );
    };

    const handleStatusFilter = (status) => {
        setStatusFilter(status === statusFilter ? 'all' : status);
    };

    const handlePriorityFilter = () => {
        setPriorityFilter(!priorityFilter);
    };

    const scrollComments = (container, direction) => {
        if (container) {
            const scrollAmount = 300; // Width of one comment card
            const newScrollPosition = container.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
            container.scrollTo({
                left: newScrollPosition,
                behavior: 'smooth'
            });
        }
    };

    const processData = (data) => {
        if (!data.values || data.values.length <= 1) return [];
        
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        // Create a map to group cases and their comments
        const casesMap = new Map();
        
        // Pre-compile regex for better performance
        const nameRegex = /Name=([^}]+)/;
        
        rows.forEach(row => {
            // Extract name from the commentator object more efficiently
            let commentatorName = '';
            const commentator = row[12];
            
            if (commentator) {
                if (typeof commentator === 'string') {
                    const match = commentator.match(nameRegex);
                    commentatorName = match ? match[1].trim() : '';
                } else if (commentator.Name) {
                    commentatorName = commentator.Name;
                }
            }

            const caseNumber = row[1];
            
            if (!casesMap.has(caseNumber)) {
                casesMap.set(caseNumber, {
                    orderNumber: row[0],
                    caseNumber,
                    description: row[2],
                    orderStatus: row[3],
                    createdDate: row[4],
                    ownerName: row[5],
                    subCategory: row[6],
                    priority: row[7],
                    feedbackType: row[8],
                    id: row[9],
                    comments: []
                });
            }

            if (row[10]) { // If there's a comment
                const existingCase = casesMap.get(caseNumber);
                existingCase.comments.push({
                    text: row[10],
                    date: row[11],
                    by: commentatorName
                });
            }
        });

        // Sort comments for each case by date (newest to oldest)
        const processedCases = Array.from(casesMap.values());
        processedCases.forEach(caseData => {
            caseData.comments.sort((a, b) => new Date(b.date) - new Date(a.date));
        });

        return processedCases;
    };

    const fetchData = async (isBackgroundUpdate = false) => {
        if (!isBackgroundUpdate) {
            setIsLoading(true);
        }

        try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
            const response = await axios.get(url);
            
            // Process the new data
            const processedCases = processData(response.data);
            
            // Update the state with new data
            setCases(processedCases);
            setLastUpdate(new Date().toLocaleString());

            // Cache the processed data
            localStorage.setItem('caseOverviewData', JSON.stringify(processedCases));
            localStorage.setItem('caseOverviewTimestamp', Date.now().toString());
        } catch (error) {
            console.error('Error fetching data:', error);
            if (!isBackgroundUpdate) {
                // Only use cache if this is not a background update and the fetch failed
                const cachedData = localStorage.getItem('caseOverviewData');
                if (cachedData) {
                    setCases(JSON.parse(cachedData));
                }
            }
        } finally {
            if (!isBackgroundUpdate) {
                setIsLoading(false);
            }
        }
    };

    // Function to check if a case should be shown based on agent selection
    const shouldShowCase = useCallback((caseItem, cases) => {
        if (!selectedAgent) return true;
        
        if (filters.duplicates) {
            // For duplicates view, show all cases in a group if any case has the selected agent
            const relatedCases = cases.filter(c => c.orderNumber === caseItem.orderNumber);
            return relatedCases.some(c => c.ownerName === selectedAgent);
        } else if (filters.assigned) {
            // For assigned view, show only cases owned by the selected agent
            return caseItem.ownerName === selectedAgent;
        }
        
        return true;
    }, [selectedAgent, filters.duplicates, filters.assigned]);

    // Group cases by order number for duplicates view
    const groupDuplicateCases = (cases) => {
        const orderGroups = new Map();
        cases.forEach(caseItem => {
            if (caseItem.orderNumber) {
                if (!orderGroups.has(caseItem.orderNumber)) {
                    orderGroups.set(caseItem.orderNumber, []);
                }
                orderGroups.get(caseItem.orderNumber).push({
                    ...caseItem,
                    isGroupStart: false,
                    isGroupEnd: false,
                    groupSize: 0
                });
            }
        });
        
        // Filter out groups with only one case and add group markers
        const duplicateGroups = Array.from(orderGroups.values())
            .filter(group => group.length > 1)
            .map(group => {
                return group.map((caseItem, index) => ({
                    ...caseItem,
                    isGroupStart: index === 0,
                    isGroupEnd: index === group.length - 1,
                    groupSize: group.length
                }));
            });
            
        // Flatten the groups while maintaining order
        return duplicateGroups.flat();
    };

    const filterCases = (cases) => {
        let filteredCases = [...cases];

        // Apply owner filters first
        const ownerFilterKeys = ['assigned', 'unassigned', 'otherQueues', 'myOpenCases', 'caseAssignment'];
        const activeOwnerFilters = Object.entries(filters)
            .filter(([key, value]) => ownerFilterKeys.includes(key) && value).length;

        if (activeOwnerFilters > 0) {
            filteredCases = filteredCases.filter(caseItem => {
                if (filters.assigned) {
                    if ([...tier2Members, ...supportMembers].includes(caseItem.ownerName)) return true;
                }
                if (filters.unassigned && caseItem.ownerName === 'Internal Queue') return true;
                if (filters.otherQueues && otherQueuesList.includes(caseItem.ownerName)) return true;
                if (filters.myOpenCases && currentUser && caseItem.ownerName === currentUser.username) return true;
                if (filters.caseAssignment) return true;
                return false;
            });
        }

        // Apply high priority filter
        if (filters.highPriority) {
            filteredCases = filteredCases.filter(caseItem => {
                const isInternal = caseItem.feedbackType === 'Internal';
                return isInternal && priorityList.includes(caseItem.priority);
            });
        }

        // Apply duplicates filter
        if (filters.duplicates) {
            filteredCases = groupDuplicateCases(filteredCases);
        }

        // Apply agent filter
        if (selectedAgent) {
            filteredCases = filteredCases.filter(caseItem => 
                shouldShowCase(caseItem, cases)
            );
        }

        // Apply search filter
        if (searchQuery) {
            filteredCases = filteredCases.filter(caseItem =>
                Object.values(caseItem).some(value =>
                    String(value).toLowerCase().includes(searchQuery.toLowerCase())
                )
            );
        }

        // Apply status filter
        switch(statusFilter) {
            case 'untouched':
                filteredCases = filteredCases.filter(caseItem =>
                    // No comments from Tier 2 or support agents AND created more than 24 hours ago
                    !caseItem.comments?.some(comment => 
                        [...tier2Members, ...supportMembers].includes(comment.by)
                    ) &&
                    !isWithinLast24Hours(caseItem.createdDate)
                );
                break;
            case 'pending':
                filteredCases = filteredCases.filter(caseItem => {
                    // Has comments from Tier 2 or support agents BUT none in the last 24 hours
                    const hasTeamComments = caseItem.comments?.some(comment =>
                        [...tier2Members, ...supportMembers].includes(comment.by)
                    );
                    const hasNoRecentTeamComments = !caseItem.comments?.some(comment =>
                        [...tier2Members, ...supportMembers].includes(comment.by) &&
                        isWithinLast24Hours(comment.date)
                    );
                    return hasTeamComments && hasNoRecentTeamComments;
                });
                break;
            case 'new':
                filteredCases = filteredCases.filter(caseItem =>
                    // No comments from Tier 2 or support agents AND created less than 24 hours ago
                    !caseItem.comments?.some(comment => 
                        [...tier2Members, ...supportMembers].includes(comment.by)
                    ) &&
                    isWithinLast24Hours(caseItem.createdDate)
                );
                break;
            case 'priority':
                filteredCases = filteredCases.filter(caseItem =>
                    priorityList.includes(caseItem.priority)
                );
                break;
            case 'all':
            default:
                break;
        }

        return filteredCases;
    };

    const getCaseCategory = (caseItem) => {
        if (isWithinLast24Hours(caseItem.createdDate) && !hasTier2Comments(caseItem.comments || [])) {
            return { text: 'New Case', color: 'bg-emerald-100 text-emerald-800' };
        }
        if (!hasTier2Comments(caseItem.comments || [])) {
            return { text: 'Untouched', color: 'bg-rose-100 text-rose-800' };
        }
        if (hasTier2Comments(caseItem.comments || []) && !hasRecentTier2Comments(caseItem.comments || [])) {
            return { text: 'Pending', color: 'bg-amber-100 text-amber-800' };
        }
        return null;
    };

    const getCaseStatus = (caseItem) => {
        if (!caseItem.comments || caseItem.comments.length === 0) {
            return 'Untouched';
        }
        
        const hasOwner = caseItem.ownerName && caseItem.ownerName.trim() !== '';
        const hasComments = caseItem.comments.length > 0;
        
        if (!hasOwner && !hasComments) {
            return 'New Case';
        } else if (hasComments) {
            return 'Pending';
        }
        
        return 'Untouched';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const options = { 
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        return date.toLocaleString('en-US', options);
    };

    const getPaginatedCases = (cases) => {
        const startIndex = (currentPage - 1) * pageSize;
        return cases.slice(startIndex, startIndex + pageSize);
    };

    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const allCaseIds = filteredCases.map(caseItem => caseItem.caseNumber);
            setSelectedCases(new Set(allCaseIds));
        } else {
            setSelectedCases(new Set());
        }
    };

    const handleSelectCase = (caseNumber) => {
        setSelectedCases(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(caseNumber)) {
                newSelected.delete(caseNumber);
            } else {
                newSelected.add(caseNumber);
            }
            return newSelected;
        });
    };

    const handleExport = () => {
        // Create workbook and worksheet
        const workbook = utils.book_new();
        
        // Transform the selected cases into the desired format
        const exportData = Array.from(selectedCases).map(caseId => {
            const caseItem = cases.find(c => c.caseNumber === caseId);
            return {
                'Case Number': caseItem.caseNumber || '',
                'Subcategory': caseItem.subCategory || '',
                'Status': getCaseStatus(caseItem),
                'Order Number': caseItem.orderNumber || '',
                'Order Status': caseItem.orderStatus || '',
                'Owner': caseItem.ownerName || '',
                'Feedback Type': caseItem.feedbackType || '',
                'Priority': caseItem.priority || ''
            };
        });

        // Create worksheet from data
        const worksheet = utils.json_to_sheet(exportData);

        // Add worksheet to workbook
        utils.book_append_sheet(workbook, worksheet, 'Cases');

        // Generate filename with current date
        const date = new Date().toISOString().split('T')[0];
        const filename = `cases_export_${date}.xlsx`;

        // Save the file
        writeFile(workbook, filename);
    };

    const caseGroupHasSelectedAgent = useCallback((caseItem, cases) => {
        if (!selectedAgent || !filters.duplicates) return true;
        
        // Find all cases with the same order number
        const relatedCases = cases.filter(c => c.orderNumber === caseItem.orderNumber);
        
        // Check if any case in the group has the selected agent as owner
        return relatedCases.some(c => c.ownerName === selectedAgent);
    }, [selectedAgent, filters.duplicates]);

    const sortedTeamMembers = useMemo(() => {
        return {
            tier2: [...tier2Members].sort(),
            support: [...supportMembers].filter(member => !tier2Members.includes(member)).sort()
        };
    }, [tier2Members, supportMembers]);

    const filteredCases = filterCases(cases);
    const paginatedCases = getPaginatedCases(filteredCases);

    // Add styles to document head instead of using style tag
    React.useEffect(() => {
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .no-scrollbar::-webkit-scrollbar {
                height: 6px;
            }
            .no-scrollbar::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            .no-scrollbar::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 3px;
            }
            .no-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
            .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
            .custom-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: #c1c1c1 #f1f1f1;
            }
            .hide-scrollbar::-webkit-scrollbar {
                display: none;
            }
            .hide-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
            .line-clamp-2 {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
            .custom-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: #c1c1c1 #f1f1f1;
            }
            select.agent-dropdown {
                max-height: 38px;
            }
            select.agent-dropdown option {
                padding: 4px 12px;
            }
            select.agent-dropdown option:disabled {
                font-weight: 600;
                color: #4B5563;
                background-color: #F3F4F6;
                padding: 4px 12px;
            }
            @-moz-document url-prefix() {
                select.agent-dropdown {
                    scrollbar-width: thin;
                    scrollbar-color: #c1c1c1 #f1f1f1;
                }
            }
            select.agent-dropdown:focus {
                max-height: 160px;
            }
        `;
        document.head.appendChild(styleEl);
        return () => document.head.removeChild(styleEl);
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white shadow-sm rounded-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center">
                            <h1 className="text-2xl font-semibold text-gray-900">Case Overview</h1>
                            <span className="ml-3 inline-flex items-center justify-center h-6 px-3 text-sm font-medium rounded-full bg-blue-100 text-blue-800 translate-y-[1px]">
                                {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'}
                            </span>
                        </div>
                        <div className="space-x-2">
                            <button 
                                className={`px-4 py-2 rounded transition-colors ${
                                    statusFilter === 'all' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                                onClick={() => handleStatusFilter('all')}
                            >
                                All Cases
                            </button>
                            <button 
                                className={`px-4 py-2 rounded transition-colors ${
                                    statusFilter === 'untouched' 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                                onClick={() => handleStatusFilter('untouched')}
                            >
                                Untouched
                            </button>
                            <button 
                                className={`px-4 py-2 rounded transition-colors ${
                                    statusFilter === 'pending' 
                                    ? 'bg-yellow-500 text-white' 
                                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                }`}
                                onClick={() => handleStatusFilter('pending')}
                            >
                                Pending
                            </button>
                            <button 
                                className={`px-4 py-2 rounded transition-colors ${
                                    statusFilter === 'new' 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                                onClick={() => handleStatusFilter('new')}
                            >
                                New Case
                            </button>
                            {!filters.highPriority && (
                                <button 
                                    className={`px-4 py-2 rounded transition-colors ${
                                        statusFilter === 'priority' 
                                        ? 'bg-purple-500 text-white' 
                                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                    }`}
                                    onClick={() => handleStatusFilter('priority')}
                                >
                                    Priority
                                </button>
                            )}
                            {(filters.duplicates || filters.assigned || filters.caseAssignment) && (
                                <select
                                    value={selectedAgent}
                                    onChange={(e) => setSelectedAgent(e.target.value)}
                                    className="agent-dropdown h-[38px] px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer appearance-none min-w-[160px]"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 8px center',
                                        backgroundSize: '16px',
                                        paddingRight: '32px',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <option value="">Select Agent</option>
                                    {sortedTeamMembers.tier2.length > 0 && (
                                        <>
                                            <option disabled className="bg-gray-100 font-medium">Tier 2</option>
                                            {sortedTeamMembers.tier2.map((member) => (
                                                <option 
                                                    key={member} 
                                                    value={member}
                                                    className="py-1 pl-4"
                                                >
                                                    {member}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                    {sortedTeamMembers.support.length > 0 && (
                                        <>
                                            <option disabled className="bg-gray-100 font-medium">Support</option>
                                            {sortedTeamMembers.support.map((member) => (
                                                <option 
                                                    key={member} 
                                                    value={member}
                                                    className="py-1 pl-4"
                                                >
                                                    {member}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="mb-6 flex flex-col space-y-4">
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Search cases..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <span className="absolute right-3 top-2.5 text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </span>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto border rounded-lg shadow">
                        <div className="inline-block min-w-full align-middle">
                            <div className="px-4 py-2 bg-white border-b flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedCases.size > 0 && selectedCases.size === filteredCases.length}
                                        onChange={handleSelectAll}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-600">
                                        {selectedCases.size} cases selected
                                    </span>
                                </div>
                                <button
                                    onClick={handleExport}
                                    disabled={selectedCases.size === 0}
                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export Selected
                                </button>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200 table-fixed">
                                <thead>
                                    <tr>
                                        <th scope="col" className="w-8 px-3 py-2 bg-gray-50">
                                            <span className="sr-only">Select</span>
                                        </th>
                                        <th scope="col" className="sticky left-0 z-10 bg-gray-50 w-[200px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Case Details
                                        </th>
                                        {!filters.duplicates && (
                                            <th scope="col" className="min-w-[300px] px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Description
                                            </th>
                                        )}
                                        {filters.duplicates && (
                                            <>
                                                <th scope="col" className="w-[120px] px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Type
                                                </th>
                                                <th scope="col" className="w-[120px] px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Order #
                                                </th>
                                                <th scope="col" className="w-[180px] px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Created
                                                </th>
                                            </>
                                        )}
                                        <th scope="col" className="w-[200px] px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Owner
                                        </th>
                                        {!filters.duplicates && (
                                            <th scope="col" className="min-w-[400px] px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Comments
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading && !cases.length ? (
                                        <tr>
                                            <td colSpan="5" className="px-3 py-2 text-center text-sm text-gray-500">
                                                Loading...
                                            </td>
                                        </tr>
                                    ) : filteredCases.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-3 py-2 text-center text-sm text-gray-500">
                                                No cases found
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedCases.map((caseItem, index) => (
                                            <React.Fragment key={index}>
                                                {/* Add separator before new group */}
                                                {filters.duplicates && caseItem.isGroupStart && index > 0 && (
                                                    <tr>
                                                        <td colSpan="5" className="h-6 bg-gray-50"></td>
                                                    </tr>
                                                )}
                                                <tr className={`hover:bg-gray-50 ${
                                                    filters.duplicates && !caseItem.isGroupEnd ? 'border-b-0' : ''
                                                }`}>
                                                    <td className="w-8 px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCases.has(caseItem.caseNumber)}
                                                            onChange={() => handleSelectCase(caseItem.caseNumber)}
                                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                    </td>
                                                    <td className={`sticky left-0 z-10 bg-white px-3 py-2 ${
                                                        filters.duplicates ? 'border-l-4 border-indigo-200' : ''
                                                    }`}>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <a 
                                                                    href={`https://altayer.lightning.force.com/lightning/r/Case/${caseItem.id}/view`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                                >
                                                                    {caseItem.caseNumber}
                                                                </a>
                                                                {filters.duplicates && caseItem.isGroupStart && (
                                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                                                                        Group of {caseItem.groupSize}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {(() => {
                                                                const category = getCaseCategory(caseItem);
                                                                return category && (
                                                                    <div>
                                                                        <span className={`px-2 py-0.5 text-xs leading-5 font-medium rounded-full ${category.color}`}>
                                                                            {category.text}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                            {caseItem.orderStatus && (
                                                                <div>
                                                                    <span className={`px-2 py-0.5 text-xs leading-5 font-medium rounded-full 
                                                                        ${caseItem.orderStatus.toLowerCase() === 'completed' ? 'bg-teal-100 text-teal-800' : 
                                                                        caseItem.orderStatus.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-800' : 
                                                                        'bg-slate-100 text-slate-800'}`}> 
                                                                        {caseItem.orderStatus}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {!filters.duplicates && (
                                                        <td className="px-3 py-2">
                                                            <div className="group relative">
                                                                <div className="mb-2 flex items-center gap-2">
                                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                                                                        {caseItem.feedbackType || 'No Type'}
                                                                    </span>
                                                                    <span className="font-medium text-sm text-gray-900">
                                                                        {caseItem.orderNumber} - {caseItem.subCategory}
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm text-gray-700 line-clamp-2 max-w-[300px]">
                                                                    {caseItem.description}
                                                                </div>
                                                                <div className="hidden group-hover:block absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-4 mt-1 max-w-[400px] whitespace-pre-wrap">
                                                                    <div className="mb-2 flex items-center gap-2">
                                                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                                                                            {caseItem.feedbackType || 'No Type'}
                                                                        </span>
                                                                        <span className="font-medium text-sm text-gray-900">
                                                                            {caseItem.orderNumber} - {caseItem.subCategory}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-sm text-gray-700">
                                                                        {caseItem.description}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-2">
                                                                        {formatDate(caseItem.createdDate)}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {formatDate(caseItem.createdDate)}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {filters.duplicates && (
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center space-x-3">
                                                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 whitespace-nowrap">
                                                                    {caseItem.feedbackType || 'No Type'}
                                                                </span>
                                                                <span className="font-medium text-sm text-gray-900 whitespace-nowrap">
                                                                    {caseItem.subCategory}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {filters.duplicates && (
                                                        <td className="px-3 py-2">
                                                            <span className="font-medium text-sm text-gray-900">
                                                                {caseItem.orderNumber}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {filters.duplicates && (
                                                        <td className="px-3 py-2">
                                                            <span className="text-xs text-gray-500 whitespace-nowrap">
                                                                {formatDate(caseItem.createdDate)}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2">
                                                        <div className="max-w-[200px] break-words">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm text-gray-900">
                                                                    {caseItem.ownerName}
                                                                </span>
                                                                {caseItem.ownerName && getUserTeam(caseItem.ownerName) && (
                                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                                                                        getUserTeam(caseItem.ownerName).isDepartment 
                                                                        ? 'bg-purple-100 text-purple-800' 
                                                                        : 'bg-blue-100 text-blue-800'
                                                                    }`}>
                                                                        {getUserTeam(caseItem.ownerName).name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {!filters.duplicates && (
                                                        <td className="px-3 py-2 max-w-[400px]">
                                                            {caseItem.comments && caseItem.comments.length > 0 ? (
                                                                <div className="relative max-w-full">
                                                                    <div className="overflow-x-auto flex space-x-4 pb-2 no-scrollbar" 
                                                                         style={{ 
                                                                            scrollbarWidth: 'thin',
                                                                            msOverflowStyle: 'none'
                                                                         }}>
                                                                        {caseItem.comments.map((comment, commentIndex) => (
                                                                            <div
                                                                                key={commentIndex}
                                                                                className="flex-shrink-0 w-[250px] bg-white rounded-lg shadow p-3 border border-gray-100"
                                                                            >
                                                                                <div className="space-y-2">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className="font-medium text-sm text-gray-900">
                                                                                            {comment.by}
                                                                                        </span>
                                                                                        {comment.by && getUserTeam(comment.by) && (
                                                                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                                                                                                getUserTeam(comment.by).isDepartment 
                                                                                                ? 'bg-purple-100 text-purple-800' 
                                                                                                : 'bg-blue-100 text-blue-800'
                                                                                            }`}>
                                                                                                {getUserTeam(comment.by).name}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-xs text-gray-500">
                                                                                        {formatDate(comment.date)}
                                                                                    </div>
                                                                                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                                                                        {comment.text}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-gray-500">No comments</div>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {filteredCases.length > pageSize && (
                        <div className="mt-4 flex justify-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="px-4 py-2 text-sm font-medium text-gray-700">
                                Page {currentPage} of {Math.ceil(filteredCases.length / pageSize)}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredCases.length / pageSize), prev + 1))}
                                disabled={currentPage >= Math.ceil(filteredCases.length / pageSize)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col space-y-2">
                <Link
                    to="/cases/assigned"
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                        initialFilter === 'assigned'
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                    <span className="truncate">Assigned Cases</span>
                </Link>
                <Link
                    to="/cases/unassigned"
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                        initialFilter === 'unassigned'
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                    <span className="truncate">Unassigned Cases</span>
                </Link>
                <Link
                    to="/cases/case-assignment"
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                        initialFilter === 'case-assignment'
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                    <span className="truncate">Case Assignment</span>
                </Link>
            </div>
        </div>
    );
};

export default CaseOverview;