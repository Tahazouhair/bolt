import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const Settings = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        
        // Reset message
        setMessage({ type: '', text: '' });

        // Validate passwords
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/api/update-password`, {
                currentPassword,
                newPassword
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            });

            setMessage({ type: 'success', text: 'Password updated successfully' });
            
            // Clear form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.message || 'Error updating password'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <div className="sm:flex sm:items-center">
                    <div className="sm:flex-auto">
                        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
                        <p className="mt-2 text-sm text-gray-700">
                            Update your account settings and preferences.
                        </p>
                    </div>
                </div>

                {message.text && (
                    <div className={`mt-4 p-4 text-sm ${
                        message.type === 'error' ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100'
                    } rounded-lg`} role="alert">
                        <span className="font-medium">{message.type === 'error' ? 'Error!' : 'Success!'}</span> {message.text}
                    </div>
                )}

                <div className="mt-8">
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                        <div className="bg-white px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Update Password</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Ensure your account is using a long, random password to stay secure.
                            </p>

                            <form onSubmit={handlePasswordUpdate} className="mt-6 space-y-4">
                                <div>
                                    <label htmlFor="current-password" className="block text-sm text-gray-700">
                                        Current Password
                                    </label>
                                    <input
                                        type="password"
                                        id="current-password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="new-password" className="block text-sm text-gray-700">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        id="new-password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Password must be at least 6 characters long
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="confirm-password" className="block text-sm text-gray-700">
                                        Confirm New Password
                                    </label>
                                    <input
                                        type="password"
                                        id="confirm-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                <div className="mt-5 flex flex-row-reverse gap-3">
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center">
                                                <span className="mr-2">
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                                                </span>
                                                Updating...
                                            </span>
                                        ) : (
                                            'Update Password'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCurrentPassword('');
                                            setNewPassword('');
                                            setConfirmPassword('');
                                            setMessage({ type: '', text: '' });
                                        }}
                                        disabled={isLoading}
                                        className="inline-flex justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                    >
                                        Reset Form
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
