import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Plus, CheckCircle2, XCircle, Trash2, Edit, Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToPDF, exportToExcel, exportToJSON } from '../utils/exportUtils';

function Tasks() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    memberId: '',
    status: 'pending',
  });
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    fetchMembers();
    fetchTasks();
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

  const fetchTasks = async () => {
    try {
      let querySnapshot;
      try {
        const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      } catch (orderError) {
        querySnapshot = await getDocs(collection(db, 'tasks'));
      }
      const tasksData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      tasksData.sort((a, b) => {
        const dateA = a.createdAt || a.updatedAt || '';
        const dateB = b.createdAt || b.updatedAt || '';
        return dateB.localeCompare(dateA);
      });
      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), {
          ...taskFormData,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Task updated successfully!');
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...taskFormData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success('Task added successfully!');
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      setTaskFormData({ title: '', description: '', memberId: '', status: 'pending' });
      fetchTasks();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Failed to save task. Please try again.');
    }
  };

  const handleToggleStatus = async (task) => {
    try {
      const newStatus = task.status === 'done' ? 'pending' : 'done';
      await updateDoc(doc(db, 'tasks', task.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Task marked as ${newStatus === 'done' ? 'completed' : 'pending'}!`);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    const confirmed = await new Promise((resolve) => {
      toast((t) => (
        <div className="flex flex-col gap-3">
          <span className="font-medium">Are you sure you want to delete this task?</span>
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
              className="px-4 py-2 bg-black dark:bg-gray-600 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-500"
            >
              Delete
            </button>
          </div>
        </div>
      ), { duration: Infinity });
    });

    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'tasks', id));
        toast.success('Task deleted successfully!');
        fetchTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
        toast.error('Failed to delete task. Please try again.');
      }
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title || '',
      description: task.description || '',
      memberId: task.memberId || '',
      status: task.status || 'pending',
    });
    setIsTaskModalOpen(true);
  };

  const getMemberName = (memberId) => {
    const member = members.find((m) => m.id === memberId);
    return member ? member.fullName : 'Unknown';
  };

  const handleExport = (format) => {
    const exportData = tasks.map(task => ({
      member: getMemberName(task.memberId),
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'pending',
      createdAt: task.createdAt || '',
    }));

    const exportColumns = [
      { header: 'Member', key: 'member', accessor: (row) => row.member },
      { header: 'Title', key: 'title', accessor: (row) => row.title },
      { header: 'Description', key: 'description', accessor: (row) => row.description },
      { header: 'Status', key: 'status', accessor: (row) => row.status },
      { header: 'Created At', key: 'createdAt', accessor: (row) => row.createdAt },
    ];

    try {
      if (format === 'pdf') {
        exportToPDF(exportData, exportColumns, 'tasks');
        toast.success('Tasks exported to PDF!');
      } else if (format === 'excel') {
        exportToExcel(exportData, exportColumns, 'tasks');
        toast.success('Tasks exported to Excel!');
      } else if (format === 'json') {
        exportToJSON(tasks, 'tasks');
        toast.success('Tasks exported to JSON!');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export. Please try again.');
    }
  };

  const filteredTasks = selectedMember
    ? tasks.filter((task) => task.memberId === selectedMember)
    : tasks;

  const tasksByMember = members.map((member) => {
    const memberTasks = tasks.filter((task) => task.memberId === member.id);
    return {
      member,
      tasks: memberTasks,
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 animate-fade-in">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Tasks</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Assign and manage tasks for your members</p>
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
              setEditingTask(null);
              setTaskFormData({ title: '', description: '', memberId: '', status: 'pending' });
              setIsTaskModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors shadow-md hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-3 sm:p-4 animate-fade-in">
        <label className="block text-sm font-medium text-black dark:text-white mb-2">Filter by Member</label>
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="w-full sm:w-64 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
        >
          <option value="">All Members</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* Tasks by Member View */}
      <div className="space-y-4 sm:space-y-6">
        {tasksByMember
          .filter((item) => !selectedMember || item.member.id === selectedMember)
          .filter((item) => item.tasks.length > 0 || !selectedMember)
          .map(({ member, tasks: memberTasks }) => (
            <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 overflow-hidden animate-fade-in">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-300 dark:border-gray-600">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white">{member.fullName}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400">{member.email}</p>
              </div>
              <div className="p-4 sm:p-6">
                {memberTasks.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm sm:text-base">No tasks assigned</p>
                ) : (
                  <div className="space-y-3">
                    {memberTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 hover:shadow-md transition-shadow"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <button
                              onClick={() => handleToggleStatus(task)}
                              className="flex-shrink-0"
                            >
                              {task.status === 'done' ? (
                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-black dark:text-white" />
                              ) : (
                                <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-400" />
                              )}
                            </button>
                            <h4
                              className={`font-medium text-sm sm:text-base flex-1 min-w-0 ${
                                task.status === 'done'
                                  ? 'text-gray-500 dark:text-gray-400 line-through'
                                  : 'text-black dark:text-white'
                              }`}
                            >
                              {task.title}
                            </h4>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                task.status === 'done'
                                  ? 'bg-gray-200 dark:bg-gray-600 text-black dark:text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white'
                              }`}
                            >
                              {task.status === 'done' ? 'Done' : 'Pending'}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 ml-0 sm:ml-9 break-words">{task.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2 sm:ml-4 justify-end sm:justify-start">
                          <button
                            onClick={() => handleEditTask(task)}
                            className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-3 sm:p-4 modal-overlay overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 my-4 modal-content">
            <h3 className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-4">
              {editingTask ? 'Edit Task' : 'Add New Task'}
            </h3>
            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Member</label>
                <select
                  required
                  value={taskFormData.memberId}
                  onChange={(e) => setTaskFormData({ ...taskFormData, memberId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Description</label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Status</label>
                <select
                  value={taskFormData.status}
                  onChange={(e) => setTaskFormData({ ...taskFormData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                >
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm sm:text-base bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {editingTask ? 'Update' : 'Add'} Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTaskModalOpen(false);
                    setEditingTask(null);
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
    </div>
  );
}

export default Tasks;

