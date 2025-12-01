import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Users, CheckSquare, Calendar, TrendingUp } from 'lucide-react';

const COLORS = ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#e5e5e5'];

function Analytics() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalMeetings: 0,
    membersInOtherDept: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch members
      let membersSnapshot;
      try {
        const membersQuery = query(collection(db, 'members'), orderBy('fullName'));
        membersSnapshot = await getDocs(membersQuery);
      } catch (orderError) {
        membersSnapshot = await getDocs(collection(db, 'members'));
      }
      const membersData = membersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      membersData.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setMembers(membersData);

      // Fetch tasks
      let tasksSnapshot;
      try {
        const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
        tasksSnapshot = await getDocs(tasksQuery);
      } catch (orderError) {
        tasksSnapshot = await getDocs(collection(db, 'tasks'));
      }
      const tasksData = tasksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      tasksData.sort((a, b) => {
        const dateA = a.createdAt || a.updatedAt || '';
        const dateB = b.createdAt || b.updatedAt || '';
        return dateB.localeCompare(dateA);
      });
      setTasks(tasksData);

      // Fetch meetings
      let meetingsSnapshot;
      try {
        const meetingsQuery = query(collection(db, 'meetings'), orderBy('date', 'desc'));
        meetingsSnapshot = await getDocs(meetingsQuery);
      } catch (orderError) {
        meetingsSnapshot = await getDocs(collection(db, 'meetings'));
      }
      const meetingsData = await Promise.all(
        meetingsSnapshot.docs.map(async (doc) => {
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

      // Calculate stats
      const completedTasks = tasksData.filter((t) => t.status === 'done').length;
      const pendingTasks = tasksData.filter((t) => t.status === 'pending').length;
      const membersInOtherDept = membersData.filter((m) => m.inOtherDepartment === 'Yes').length;

      setStats({
        totalMembers: membersData.length,
        totalTasks: tasksData.length,
        completedTasks,
        pendingTasks,
        totalMeetings: meetingsData.length,
        membersInOtherDept,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      setMembers([]);
      setTasks([]);
      setMeetings([]);
    }
  };

  // Task completion by member
  const taskCompletionByMember = members.map((member) => {
    const memberTasks = tasks.filter((task) => task.memberId === member.id);
    const completed = memberTasks.filter((t) => t.status === 'done').length;
    const pending = memberTasks.filter((t) => t.status === 'pending').length;
    return {
      name: member.fullName.split(' ')[0], // First name only for chart
      completed,
      pending,
      total: memberTasks.length,
    };
  }).filter((item) => item.total > 0);

  // Task status distribution
  const taskStatusData = [
    { name: 'Completed', value: stats.completedTasks, color: '#000000' },
    { name: 'Pending', value: stats.pendingTasks, color: '#666666' },
  ];

  // Department distribution
  const departmentData = [
    { name: 'Main Department', value: stats.totalMembers - stats.membersInOtherDept, color: '#000000' },
    { name: 'Other Department', value: stats.membersInOtherDept, color: '#666666' },
  ];

  // Presence over time
  const presenceOverTime = meetings.map((meeting) => {
    const present = meeting.presence?.filter((p) => p.status === 'present').length || 0;
    const absent = meeting.presence?.filter((p) => p.status === 'absent').length || 0;
    return {
      name: new Date(meeting.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      present,
      absent,
    };
  }).slice(0, 10).reverse(); // Last 10 meetings

  // Attendance rate by member
  const attendanceByMember = members.map((member) => {
    let presentCount = 0;
    let totalMeetings = 0;
    meetings.forEach((meeting) => {
      if (meeting.presence && meeting.presence.length > 0) {
        totalMeetings++;
        const memberPresence = meeting.presence.find((p) => p.memberId === member.id);
        if (memberPresence && memberPresence.status === 'present') {
          presentCount++;
        }
      }
    });
    const attendanceRate = totalMeetings > 0 ? (presentCount / totalMeetings) * 100 : 0;
    return {
      name: member.fullName.split(' ')[0],
      rate: Math.round(attendanceRate),
      present: presentCount,
      total: totalMeetings,
    };
  }).filter((item) => item.total > 0).sort((a, b) => b.rate - a.rate);


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Analytics</h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Insights and statistics about your team</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Members</p>
              <p className="text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">{stats.totalMembers}</p>
            </div>
            <div className="p-2 sm:p-3 bg-gray-200 dark:bg-gray-700 rounded-lg">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-black dark:text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Tasks</p>
              <p className="text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">{stats.totalTasks}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.completedTasks} completed, {stats.pendingTasks} pending
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-gray-200 dark:bg-gray-700 rounded-lg">
              <CheckSquare className="w-6 h-6 sm:w-8 sm:h-8 text-black dark:text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Meetings/Events</p>
              <p className="text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">{stats.totalMeetings}</p>
            </div>
            <div className="p-2 sm:p-3 bg-gray-200 dark:bg-gray-700 rounded-lg">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-black dark:text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Task Completion</p>
              <p className="text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">
                {stats.totalTasks > 0
                  ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                  : 0}
                %
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-gray-200 dark:bg-gray-700 rounded-lg">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-black dark:text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Task Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-black dark:text-white mb-4">Task Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <PieChart>
              <Pie
                data={taskStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#000000"
                dataKey="value"
              >
                {taskStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-black dark:text-white mb-4">Department Distribution</h3>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <PieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#000000"
                dataKey="value"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Task Completion by Member */}
        {taskCompletionByMember.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white mb-4">Task Completion by Member</h3>
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <BarChart data={taskCompletionByMember}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#000000" name="Completed" />
                <Bar dataKey="pending" fill="#666666" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Presence Over Time */}
        {presenceOverTime.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white mb-4">Presence Over Time</h3>
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <LineChart data={presenceOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#000000" name="Present" />
                <Line type="monotone" dataKey="absent" stroke="#666666" name="Absent" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Attendance Rate by Member */}
        {attendanceByMember.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4 sm:p-6 lg:col-span-2">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white mb-4">Attendance Rate by Member</h3>
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <BarChart data={attendanceByMember} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="rate" fill="#000000" name="Attendance Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;

