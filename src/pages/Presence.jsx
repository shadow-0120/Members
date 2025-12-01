import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Plus, Calendar, UserCheck, UserX, Trash2, Edit, Users, Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToPDF, exportToExcel, exportToJSON } from '../utils/exportUtils';

function Presence() {
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isPresenceModalOpen, setIsPresenceModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingFormData, setMeetingFormData] = useState({
    title: '',
    date: '',
    description: '',
  });
  const [presenceData, setPresenceData] = useState({});
  const [editingMeeting, setEditingMeeting] = useState(null);

  useEffect(() => {
    fetchMembers();
    fetchMeetings();
  }, []);

  const fetchMembers = async () => {
    try {
      let querySnapshot;
      try {
        const q = query(collection(db, 'members'), orderBy('fullName'));
        querySnapshot = await getDocs(q);
      } catch (orderError) {
        querySnapshot = await getDocs(collection(db, 'members'));
      }
      const membersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      membersData.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]);
    }
  };

  const fetchMeetings = async () => {
    try {
      let querySnapshot;
      try {
        const q = query(collection(db, 'meetings'), orderBy('date', 'desc'));
        querySnapshot = await getDocs(q);
      } catch (orderError) {
        querySnapshot = await getDocs(collection(db, 'meetings'));
      }
      const meetingsData = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          try {
            const presenceRef = collection(db, 'meetings', doc.id, 'presence');
            const presenceSnapshot = await getDocs(presenceRef);
            const presence = presenceSnapshot.docs.map((pDoc) => ({
              id: pDoc.id,
              ...pDoc.data(),
            }));
            return {
              id: doc.id,
              ...doc.data(),
              presence,
            };
          } catch (presenceError) {
            return {
              id: doc.id,
              ...doc.data(),
              presence: [],
            };
          }
        })
      );
      meetingsData.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
    }
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMeeting) {
        await updateDoc(doc(db, 'meetings', editingMeeting.id), {
          ...meetingFormData,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Meeting updated successfully!');
      } else {
        await addDoc(collection(db, 'meetings'), {
          ...meetingFormData,
          createdAt: new Date().toISOString(),
        });
        toast.success('Meeting added successfully!');
      }
      setIsMeetingModalOpen(false);
      setEditingMeeting(null);
      setMeetingFormData({ title: '', date: '', description: '' });
      fetchMeetings();
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting. Please try again.');
    }
  };

  const handleOpenPresenceModal = (meeting) => {
    setSelectedMeeting(meeting);
    // Initialize presence data from existing presence records
    const initialPresence = {};
    members.forEach((member) => {
      const existingPresence = meeting.presence?.find((p) => p.memberId === member.id);
      initialPresence[member.id] = existingPresence?.status || 'absent';
    });
    setPresenceData(initialPresence);
    setIsPresenceModalOpen(true);
  };

  const handleSavePresence = async () => {
    try {
      // Delete existing presence records
      if (selectedMeeting.presence) {
        for (const presence of selectedMeeting.presence) {
          await deleteDoc(doc(db, 'meetings', selectedMeeting.id, 'presence', presence.id));
        }
      }

      // Add new presence records
      for (const [memberId, status] of Object.entries(presenceData)) {
        await addDoc(collection(db, 'meetings', selectedMeeting.id, 'presence'), {
          memberId,
          status,
          updatedAt: new Date().toISOString(),
        });
      }

      toast.success('Presence recorded successfully!');
      setIsPresenceModalOpen(false);
      setSelectedMeeting(null);
      setPresenceData({});
      fetchMeetings();
    } catch (error) {
      console.error('Error saving presence:', error);
      toast.error('Failed to save presence. Please try again.');
    }
  };

  const handleDeleteMeeting = async (id) => {
    const meeting = meetings.find(m => m.id === id);
    const confirmed = await new Promise((resolve) => {
      toast((t) => (
        <div className="flex flex-col gap-3">
          <span className="font-medium">Are you sure you want to delete {meeting?.title}?</span>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                resolve(false);
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                resolve(true);
              }}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Delete
            </button>
          </div>
        </div>
      ), { duration: Infinity });
    });

    if (confirmed) {
      try {
        // Delete presence records first
        const presenceRef = collection(db, 'meetings', id, 'presence');
        const presenceSnapshot = await getDocs(presenceRef);
        for (const presenceDoc of presenceSnapshot.docs) {
          await deleteDoc(doc(db, 'meetings', id, 'presence', presenceDoc.id));
        }
        // Delete meeting
        await deleteDoc(doc(db, 'meetings', id));
        toast.success('Meeting deleted successfully!');
        fetchMeetings();
      } catch (error) {
        console.error('Error deleting meeting:', error);
        toast.error('Failed to delete meeting. Please try again.');
      }
    }
  };

  const handleEditMeeting = (meeting) => {
    setEditingMeeting(meeting);
    setMeetingFormData({
      title: meeting.title || '',
      date: meeting.date || '',
      description: meeting.description || '',
    });
    setIsMeetingModalOpen(true);
  };

  const getMemberName = (memberId) => {
    const member = members.find((m) => m.id === memberId);
    return member ? member.fullName : 'Unknown';
  };

  const getPresenceStats = (meeting) => {
    if (!meeting.presence || meeting.presence.length === 0) {
      return { present: 0, absent: 0, total: members.length };
    }
    const present = meeting.presence.filter((p) => p.status === 'present').length;
    const absent = meeting.presence.filter((p) => p.status === 'absent').length;
    return { present, absent, total: members.length };
  };

  const handleExport = (format) => {
    const exportData = meetings.flatMap(meeting => {
      const stats = getPresenceStats(meeting);
      return {
        title: meeting.title || '',
        date: meeting.date || '',
        description: meeting.description || '',
        present: stats.present,
        absent: stats.absent,
        total: stats.total,
      };
    });

    const exportColumns = [
      { header: 'Title', key: 'title', accessor: (row) => row.title },
      { header: 'Date', key: 'date', accessor: (row) => row.date },
      { header: 'Description', key: 'description', accessor: (row) => row.description || '' },
      { header: 'Present', key: 'present', accessor: (row) => row.present },
      { header: 'Absent', key: 'absent', accessor: (row) => row.absent },
      { header: 'Total', key: 'total', accessor: (row) => row.total },
    ];

    try {
      if (format === 'pdf') {
        exportToPDF(exportData, exportColumns, 'meetings');
        toast.success('Meetings exported to PDF!');
      } else if (format === 'excel') {
        exportToExcel(exportData, exportColumns, 'meetings');
        toast.success('Meetings exported to Excel!');
      } else if (format === 'json') {
        exportToJSON(meetings, 'meetings');
        toast.success('Meetings exported to JSON!');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export. Please try again.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 animate-fade-in">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Presence</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Track member attendance for meetings and events</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Export Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors shadow-md hover:scale-105 active:scale-95 text-sm sm:text-base">
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">Export</span>
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <button
                onClick={() => handleExport('pdf')}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white rounded-t-lg"
              >
                <FileText className="w-4 h-4" />
                Export as PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export as Excel
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white rounded-b-lg"
              >
                <FileJson className="w-4 h-4" />
                Export as JSON
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMeeting(null);
              setMeetingFormData({ title: '', date: '', description: '' });
              setIsMeetingModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors shadow-md hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Add Meeting/Event</span>
            <span className="sm:hidden">Add Meeting</span>
          </button>
        </div>
      </div>

      {/* Meetings List */}
      <div className="grid gap-4 sm:gap-6">
        {meetings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-8 sm:p-12 text-center">
            <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">No meetings or events yet</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-2">Create your first meeting to start tracking presence</p>
          </div>
        ) : (
          meetings.map((meeting) => {
            const stats = getPresenceStats(meeting);
            return (
              <div key={meeting.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 overflow-hidden animate-fade-in">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-300 dark:border-gray-600">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-black dark:text-white break-words">{meeting.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                        {new Date(meeting.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                        {meeting.description && (
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 break-words">{meeting.description}</p>
                        )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEditMeeting(meeting)}
                        className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-300 dark:border-gray-600">
                      <div className="flex items-center gap-1 sm:gap-2 mb-1">
                        <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-black dark:text-white" />
                        <span className="text-xs sm:text-sm font-medium text-black dark:text-white">Present</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-black dark:text-white">{stats.present}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-300 dark:border-gray-600">
                      <div className="flex items-center gap-1 sm:gap-2 mb-1">
                        <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-black dark:text-white" />
                        <span className="text-xs sm:text-sm font-medium text-black dark:text-white">Absent</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-black dark:text-white">{stats.absent}</p>
                    </div>
                    <div className="bg-gray-200 dark:bg-gray-600 rounded-lg p-3 sm:p-4 border border-gray-300 dark:border-gray-600">
                      <div className="flex items-center gap-1 sm:gap-2 mb-1">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-black dark:text-white" />
                        <span className="text-xs sm:text-sm font-medium text-black dark:text-white">Total</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-black dark:text-white">{stats.total}</p>
                    </div>
                  </div>

                  {/* Presence List */}
                  {meeting.presence && meeting.presence.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {meeting.presence.map((presence) => (
                        <div
                          key={presence.id}
                          className={`flex items-center justify-between p-2 sm:p-3 rounded-lg ${
                            presence.status === 'present'
                              ? 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                              : 'bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <span className="font-medium text-black dark:text-white text-sm sm:text-base truncate mr-2">
                            {getMemberName(presence.memberId)}
                          </span>
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                              presence.status === 'present'
                                ? 'bg-black dark:bg-gray-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-black dark:text-white'
                            }`}
                          >
                            {presence.status === 'present' ? 'Present' : 'Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4 mb-4 text-sm sm:text-base">No presence recorded yet</p>
                  )}

                  <button
                    onClick={() => handleOpenPresenceModal(meeting)}
                    className="w-full px-4 py-2 text-sm sm:text-base bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {meeting.presence && meeting.presence.length > 0 ? 'Update Presence' : 'Record Presence'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Meeting Modal */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-3 sm:p-4 modal-overlay overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 my-4 modal-content">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-4">
              {editingMeeting ? 'Edit Meeting' : 'Add New Meeting/Event'}
            </h3>
            <form onSubmit={handleMeetingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={meetingFormData.title}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Date</label>
                <input
                  type="datetime-local"
                  required
                  value={meetingFormData.date}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Description</label>
                <textarea
                  value={meetingFormData.description}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, description: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingMeeting ? 'Update' : 'Add'} Meeting
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMeetingModalOpen(false);
                    setEditingMeeting(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm sm:text-base bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Presence Modal */}
      {isPresenceModalOpen && selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 modal-overlay overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-4 sm:p-6 my-4 max-h-[90vh] overflow-y-auto modal-content">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-white mb-4">
              Record Presence - <span className="break-words">{selectedMeeting.title}</span>
            </h3>
            <div className="space-y-3 mb-6">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-black dark:text-white text-sm sm:text-base break-words">{member.fullName}</p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">{member.email}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setPresenceData({ ...presenceData, [member.id]: 'present' })}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
                        presenceData[member.id] === 'present'
                          ? 'bg-black dark:bg-gray-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-black dark:text-white border border-black dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => setPresenceData({ ...presenceData, [member.id]: 'absent' })}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
                        presenceData[member.id] === 'absent'
                          ? 'bg-black text-white'
                          : 'bg-white text-black border border-black hover:bg-gray-50'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-300">
              <button
                onClick={handleSavePresence}
                className="flex-1 px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Presence
              </button>
              <button
                onClick={() => {
                  setIsPresenceModalOpen(false);
                  setSelectedMeeting(null);
                  setPresenceData({});
                }}
                className="flex-1 px-4 py-2 text-sm sm:text-base bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Presence;

