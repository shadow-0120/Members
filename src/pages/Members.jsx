import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Plus, Edit, Trash2, Search, Download, Upload, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';
import toast from 'react-hot-toast';
import { exportToPDF, exportToExcel, exportToJSON, importFromJSON } from '../utils/exportUtils';

function Members() {
  const [members, setMembers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    inOtherDepartment: 'No',
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch members from Firebase
  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      // Try with orderBy first, fallback to simple query if index doesn't exist
      let querySnapshot;
      try {
        const q = query(collection(db, 'members'), orderBy('fullName'));
        querySnapshot = await getDocs(q);
      } catch (orderError) {
        // If orderBy fails (no index), just get all members
        querySnapshot = await getDocs(collection(db, 'members'));
      }
      const membersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort manually if orderBy failed
      membersData.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await updateDoc(doc(db, 'members', editingMember.id), formData);
        toast.success('Member updated successfully!');
      } else {
        await addDoc(collection(db, 'members'), {
          ...formData,
          createdAt: new Date().toISOString(),
        });
        toast.success('Member added successfully!');
      }
      setIsModalOpen(false);
      setEditingMember(null);
      setFormData({ fullName: '', email: '', phoneNumber: '', inOtherDepartment: 'No' });
      fetchMembers();
    } catch (error) {
      console.error('Error saving member:', error);
      toast.error('Failed to save member. Please try again.');
    }
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setFormData({
      fullName: member.fullName || '',
      email: member.email || '',
      phoneNumber: member.phoneNumber || '',
      inOtherDepartment: member.inOtherDepartment || 'No',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const member = members.find(m => m.id === id);
    const confirmed = await new Promise((resolve) => {
      toast((t) => (
        <div className="flex flex-col gap-3">
          <span className="font-medium">Are you sure you want to delete {member?.fullName}?</span>
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
        await deleteDoc(doc(db, 'members', id));
        toast.success('Member deleted successfully!');
        fetchMembers();
      } catch (error) {
        console.error('Error deleting member:', error);
        toast.error('Failed to delete member. Please try again.');
      }
    }
  };

  const handleExport = (format) => {
    const exportColumns = [
      { header: 'Full Name', key: 'fullName', accessor: (row) => row.fullName || '' },
      { header: 'Email', key: 'email', accessor: (row) => row.email || '' },
      { header: 'Phone Number', key: 'phoneNumber', accessor: (row) => row.phoneNumber || '' },
      { header: 'Other Department', key: 'inOtherDepartment', accessor: (row) => row.inOtherDepartment || 'No' },
    ];

    try {
      if (format === 'pdf') {
        exportToPDF(members, exportColumns, 'members');
        toast.success('Members exported to PDF!');
      } else if (format === 'excel') {
        exportToExcel(members, exportColumns, 'members');
        toast.success('Members exported to Excel!');
      } else if (format === 'json') {
        exportToJSON(members, 'members');
        toast.success('Members exported to JSON!');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export. Please try again.');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const jsonData = await importFromJSON(file);
      
      if (!Array.isArray(jsonData)) {
        toast.error('Invalid JSON format. Expected an array of members.');
        return;
      }

      // Get emails from imported JSON
      const importedEmails = new Set(jsonData.map(m => m.email?.toLowerCase().trim()).filter(Boolean));
      
      // Find members to delete (exist in Firebase but not in JSON)
      const membersToDelete = members.filter(m => {
        const email = m.email?.toLowerCase().trim();
        return email && !importedEmails.has(email);
      });

      // Show confirmation if members will be deleted
      if (membersToDelete.length > 0) {
        const confirmed = await new Promise((resolve) => {
          toast((t) => (
            <div className="flex flex-col gap-3 max-w-md">
              <span className="font-medium">
                {membersToDelete.length} member(s) will be deleted because they are not in the imported file:
              </span>
                <div className="max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm">
                {membersToDelete.map((m, idx) => (
                  <div key={idx} className="text-gray-700 dark:text-gray-300">• {m.fullName} ({m.email})</div>
                ))}
              </div>
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
                  Continue Import
                </button>
              </div>
            </div>
          ), { duration: Infinity });
        });

        if (!confirmed) {
          event.target.value = '';
          return;
        }
      }

      // Validate and import members
      let imported = 0;
      let updated = 0;
      let added = 0;
      let errors = 0;
      let deleted = 0;

      // Delete members not in JSON
      for (const memberToDelete of membersToDelete) {
        try {
          await deleteDoc(doc(db, 'members', memberToDelete.id));
          deleted++;
        } catch (error) {
          console.error('Error deleting member:', error);
          errors++;
        }
      }

      // Import/Update members from JSON
      for (const member of jsonData) {
        try {
          if (!member.email) {
            errors++;
            continue;
          }

          // Check if member already exists (by email)
          const existingMember = members.find(m => 
            m.email?.toLowerCase().trim() === member.email?.toLowerCase().trim()
          );
          
          if (existingMember) {
            // Update existing member
            await updateDoc(doc(db, 'members', existingMember.id), {
              fullName: member.fullName || existingMember.fullName,
              email: member.email || existingMember.email,
              phoneNumber: member.phoneNumber || existingMember.phoneNumber,
              inOtherDepartment: member.inOtherDepartment || existingMember.inOtherDepartment,
            });
            updated++;
            imported++;
          } else {
            // Add new member
            await addDoc(collection(db, 'members'), {
              fullName: member.fullName || '',
              email: member.email || '',
              phoneNumber: member.phoneNumber || '',
              inOtherDepartment: member.inOtherDepartment || 'No',
              createdAt: new Date().toISOString(),
            });
            added++;
            imported++;
          }
        } catch (error) {
          console.error('Error importing member:', error);
          errors++;
        }
      }

      // Show summary
      const summary = [];
      if (added > 0) summary.push(`${added} added`);
      if (updated > 0) summary.push(`${updated} updated`);
      if (deleted > 0) summary.push(`${deleted} deleted`);
      
      if (imported > 0 || deleted > 0) {
        toast.success(
          `Import completed! ${summary.join(', ')}${errors > 0 ? `. ${errors} error(s).` : '.'}`,
          { duration: 5000 }
        );
        fetchMembers();
      } else if (errors > 0) {
        toast.error(`Failed to import. ${errors} error(s) occurred.`);
      } else {
        toast.success('Import completed with no changes.');
        fetchMembers();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import file. Please check the format.');
    }

    // Reset file input
    event.target.value = '';
  };

  // Table columns
  const columns = [
    {
      accessorKey: 'fullName',
      header: 'Full Name',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'phoneNumber',
      header: 'Phone Number',
    },
    {
      accessorKey: 'inOtherDepartment',
      header: 'Other Department',
      cell: (info) => (
        <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
            info.getValue() === 'Yes'
              ? 'bg-gray-200 dark:bg-gray-600 text-black dark:text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white'
          }`}
        >
          {info.getValue()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const member = info.row.original;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(member)}
              className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(member.id)}
              className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter: searchTerm,
    },
    onGlobalFilterChange: setSearchTerm,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const filteredData = table.getRowModel().rows.map((row) => row.original);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 animate-fade-in">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Members</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Manage all your team members</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Export/Import Dropdown */}
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
          {/* Import Button */}
          <label className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors shadow-md hover:scale-105 active:scale-95 cursor-pointer text-sm sm:text-base">
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Import JSON</span>
            <span className="sm:hidden">Import</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={() => {
              setEditingMember(null);
              setFormData({ fullName: '', email: '', phoneNumber: '', inOtherDepartment: 'No' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors shadow-md hover:scale-105 active:scale-95 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Add Member</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
        <input
          type="text"
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-300 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-black dark:text-white uppercase tracking-wider"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-300 dark:divide-gray-700">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 sm:px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                    No members found
                  </td>
                </tr>
              ) : (
                filteredData.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    {table.getRowModel().rows
                      .find((row) => row.original.id === member.id)
                      ?.getVisibleCells()
                      .map((cell) => (
                        <td key={cell.id} className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm sm:text-base text-black dark:text-white">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-3 sm:px-6 py-4 border-t border-gray-300 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              members.length
            )}{' '}
            of {members.length} members
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-3 sm:p-4 modal-overlay overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 my-4 modal-content">
            <h3 className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-4">
              {editingMember ? 'Edit Member' : 'Add New Member'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">In Other Department?</label>
                <select
                  value={formData.inOtherDepartment}
                  onChange={(e) => setFormData({ ...formData, inOtherDepartment: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm sm:text-base bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {editingMember ? 'Update' : 'Add'} Member
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingMember(null);
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

export default Members;

