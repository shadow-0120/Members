import { useState } from 'react';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import toast from 'react-hot-toast';
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  RotateCcw, 
  Bell, 
  Globe, 
  Palette,
  Trash2,
  AlertTriangle,
  LogOut
} from 'lucide-react';

function Settings() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : true;
  });
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language');
    return saved || 'en';
  });

  const handleNotificationsToggle = () => {
    const newValue = !notifications;
    setNotifications(newValue);
    localStorage.setItem('notifications', JSON.stringify(newValue));
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('Logged out successfully!');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out. Please try again.');
      setIsLoggingOut(false);
    }
  };

  const resetAnalytics = async () => {
    setIsResetting(true);
    try {
      // Delete all members
      const membersSnapshot = await getDocs(collection(db, 'members'));
      const membersDeletePromises = membersSnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(membersDeletePromises);

      // Delete all tasks
      const tasksSnapshot = await getDocs(collection(db, 'tasks'));
      const tasksDeletePromises = tasksSnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(tasksDeletePromises);

      // Delete all meetings and their presence subcollections
      const meetingsSnapshot = await getDocs(collection(db, 'meetings'));
      const meetingsDeletePromises = meetingsSnapshot.docs.map(async (meetingDoc) => {
        // Delete all presence records for this meeting
        const presenceRef = collection(db, 'meetings', meetingDoc.id, 'presence');
        const presenceSnapshot = await getDocs(presenceRef);
        const presenceDeletePromises = presenceSnapshot.docs.map((presenceDoc) => deleteDoc(presenceDoc.ref));
        await Promise.all(presenceDeletePromises);
        // Delete the meeting itself
        return deleteDoc(meetingDoc.ref);
      });
      await Promise.all(meetingsDeletePromises);

      setShowResetConfirm(false);
      alert('All data has been reset successfully!');
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('Error resetting data. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Settings</h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Customize your experience and manage your preferences
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Appearance Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-5 h-5 text-black dark:text-white" />
            <h3 className="text-lg font-semibold text-black dark:text-white">Appearance</h3>
          </div>
          
          <div className="space-y-4">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              <div className="flex items-center gap-3">
                {isDarkMode ? (
                  <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-black dark:text-white">Dark Mode</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Switch between light and dark themes
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleDarkMode();
                }}
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDarkMode ? 'bg-black dark:bg-gray-600' : 'bg-gray-300'
                }`}
                aria-label="Toggle dark mode"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-5 h-5 text-black dark:text-white" />
            <h3 className="text-lg font-semibold text-black dark:text-white">Preferences</h3>
          </div>
          
          <div className="space-y-4">
            {/* Notifications Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-black dark:text-white">Notifications</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enable or disable notifications
                  </p>
                </div>
              </div>
              <button
                onClick={handleNotificationsToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications ? 'bg-black dark:bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Language Selection */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-black dark:text-white">Language</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose your preferred language
                  </p>
                </div>
              </div>
              <select
                value={language}
                onChange={handleLanguageChange}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-gray-500"
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <LogOut className="w-5 h-5 text-black dark:text-white" />
            <h3 className="text-lg font-semibold text-black dark:text-white">Account</h3>
          </div>
          
          <div className="space-y-4">
            {/* User Email Display */}
            {currentUser && (
              <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Signed in as</p>
                <p className="font-medium text-black dark:text-white">{currentUser.email}</p>
              </div>
            )}

            {/* Sign Out Button */}
            <div className="pt-2">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoggingOut ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Data Management Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-black dark:text-white">Data Management</h3>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-300 mb-1">Danger Zone</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                    Resetting will permanently delete all members, tasks, and meetings data. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                    disabled={isResetting}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset All Data</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-5 h-5 text-black dark:text-white" />
            <h3 className="text-lg font-semibold text-black dark:text-white">About</h3>
          </div>
          
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong className="text-black dark:text-white">Web Development Cell</strong></p>
            <p>Version 1.0.0</p>
            <p>Manage your team members, tasks, and track presence efficiently.</p>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-md w-full animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              <h3 className="text-xl font-bold text-black dark:text-white">Reset All Data</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to reset all data? This will permanently delete all members, tasks, and meetings data. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-black dark:text-white rounded-lg transition-colors"
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                onClick={resetAnalytics}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;

