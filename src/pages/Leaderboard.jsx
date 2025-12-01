import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Trophy, Medal, Award, TrendingUp, CheckCircle2, Calendar, Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToPDF, exportToExcel, exportToJSON } from '../utils/exportUtils';

function Leaderboard() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

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
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMembers([]);
      setTasks([]);
      setMeetings([]);
    }
  };

  useEffect(() => {
    calculateLeaderboard();
  }, [members, tasks, meetings]);

  const calculateLeaderboard = () => {
    const scores = members.map((member) => {
      // Calculate task score (completed tasks)
      const memberTasks = tasks.filter((task) => task.memberId === member.id);
      const completedTasks = memberTasks.filter((task) => task.status === 'done').length;
      const totalTasks = memberTasks.length;
      const taskScore = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      const taskPoints = completedTasks * 10; // 10 points per completed task

      // Calculate presence score
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
      const presenceRate = totalMeetings > 0 ? (presentCount / totalMeetings) * 100 : 0;
      const presencePoints = presentCount * 5; // 5 points per present attendance

      // Total score (weighted: 60% tasks, 40% presence)
      const totalScore = taskPoints + presencePoints;
      const activityScore = (taskScore * 0.6) + (presenceRate * 0.4);

      return {
        member,
        completedTasks,
        totalTasks,
        taskScore: Math.round(taskScore),
        presentCount,
        totalMeetings,
        presenceRate: Math.round(presenceRate),
        totalScore,
        activityScore: Math.round(activityScore),
      };
    });

    // Sort by total score (descending)
    scores.sort((a, b) => b.totalScore - a.totalScore);
    setLeaderboard(scores);
  };

  const getRankIcon = (index) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-black dark:text-white" />;
    if (index === 1) return <Medal className="w-6 h-6 text-black dark:text-white" />;
    if (index === 2) return <Award className="w-6 h-6 text-black dark:text-white" />;
    return <span className="text-lg font-bold text-black dark:text-white">#{index + 1}</span>;
  };

  const getRankBadge = (index) => {
    if (index === 0) return 'bg-black text-white';
    if (index === 1) return 'bg-gray-800 text-white';
    if (index === 2) return 'bg-gray-700 text-white';
    return 'bg-gray-100 text-black';
  };

  const handleExport = (format) => {
    const exportData = leaderboard.map((entry, index) => ({
      rank: index + 1,
      member: entry.member.fullName,
      email: entry.member.email,
      totalScore: entry.totalScore,
      completedTasks: entry.completedTasks,
      totalTasks: entry.totalTasks,
      taskScore: entry.taskScore,
      presentCount: entry.presentCount,
      totalMeetings: entry.totalMeetings,
      presenceRate: entry.presenceRate,
    }));

    const exportColumns = [
      { header: 'Rank', key: 'rank', accessor: (row) => row.rank },
      { header: 'Member', key: 'member', accessor: (row) => row.member },
      { header: 'Email', key: 'email', accessor: (row) => row.email },
      { header: 'Total Score', key: 'totalScore', accessor: (row) => row.totalScore },
      { header: 'Completed Tasks', key: 'completedTasks', accessor: (row) => `${row.completedTasks}/${row.totalTasks}` },
      { header: 'Task Score %', key: 'taskScore', accessor: (row) => `${row.taskScore}%` },
      { header: 'Present', key: 'presentCount', accessor: (row) => `${row.presentCount}/${row.totalMeetings}` },
      { header: 'Attendance Rate %', key: 'presenceRate', accessor: (row) => `${row.presenceRate}%` },
    ];

    try {
      if (format === 'pdf') {
        exportToPDF(exportData, exportColumns, 'leaderboard');
        toast.success('Leaderboard exported to PDF!');
      } else if (format === 'excel') {
        exportToExcel(exportData, exportColumns, 'leaderboard');
        toast.success('Leaderboard exported to Excel!');
      } else if (format === 'json') {
        exportToJSON(leaderboard, 'leaderboard');
        toast.success('Leaderboard exported to JSON!');
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
          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Leaderboard</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Top performers based on completed tasks and attendance</p>
        </div>
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
      </div>

      {/* Top 3 Podium */}
      {leaderboard.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 sm:mb-8">
          {leaderboard.slice(0, 3).map((entry, index) => (
            <div
              key={entry.member.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-300 dark:border-gray-700 p-4 sm:p-6 text-center animate-scale-in ${
                index === 0 ? 'order-2 sm:order-1' : index === 1 ? 'order-1 sm:order-2' : 'order-3'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex justify-center mb-3 sm:mb-4">
                {getRankIcon(index)}
              </div>
              <div className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-bold mb-2 sm:mb-3 ${getRankBadge(index)}`}>
                Rank #{index + 1}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white mb-2 break-words">{entry.member.fullName}</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 break-words">{entry.member.email}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4 text-black" />
                  <span className="text-base sm:text-lg font-bold text-black dark:text-white">{entry.totalScore} pts</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{entry.completedTasks}/{entry.totalTasks} tasks</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{entry.presentCount}/{entry.totalMeetings} present</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 overflow-hidden animate-fade-in">
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
          <h3 className="text-base sm:text-lg font-semibold text-black dark:text-white">Full Leaderboard</h3>
        </div>
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black dark:text-white uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Member
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Total Score
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Completed Tasks
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Task Completion
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Attendance
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Attendance Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-300 dark:divide-gray-700">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 sm:px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                    No data available yet. Complete tasks and attend meetings to see rankings!
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry, index) => (
                  <tr
                    key={entry.member.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      index < 3 ? 'bg-gray-50 dark:bg-gray-700' : ''
                    }`}
                  >
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getRankIcon(index)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-black dark:text-white text-sm sm:text-base">{entry.member.fullName}</div>
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{entry.member.email}</div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-black dark:text-white" />
                        <span className="font-bold text-black dark:text-white text-sm sm:text-base">{entry.totalScore}</span>
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">pts</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-black dark:text-white" />
                        <span className="text-black dark:text-white text-sm sm:text-base">
                          {entry.completedTasks} / {entry.totalTasks}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 sm:w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-black dark:bg-gray-400 h-2 rounded-full"
                            style={{ width: `${entry.taskScore}%` }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm text-black dark:text-white font-medium">{entry.taskScore}%</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-black dark:text-white" />
                        <span className="text-black dark:text-white text-sm sm:text-base">
                          {entry.presentCount} / {entry.totalMeetings}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 sm:w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-black dark:bg-gray-400 h-2 rounded-full"
                            style={{ width: `${entry.presenceRate}%` }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm text-black dark:text-white font-medium">{entry.presenceRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scoring Explanation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-black dark:text-white mb-4">Scoring System</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h4 className="font-medium text-black dark:text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Task Points
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 10 points per completed task</li>
              <li>• Task completion rate: 60% weight</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-black dark:text-white mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Attendance Points
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 5 points per present attendance</li>
              <li>• Attendance rate: 40% weight</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <strong className="text-black dark:text-white">Total Score</strong> = (Completed Tasks × 10) + (Present Attendances × 5)
          </p>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;

