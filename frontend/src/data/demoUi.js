export const roleLabels = {
  admin: 'Admin Prodi',
  dosen: 'Dosen',
  kaprodi: 'Kaprodi',
  dekan: 'Dekan',
  super_admin: 'Super Admin',
}

export const roleOptions = [
  { value: 'admin', label: 'Admin Prodi' },
  { value: 'dosen', label: 'Dosen' },
  { value: 'kaprodi', label: 'Kaprodi' },
  { value: 'dekan', label: 'Dekan' },
  { value: 'super_admin', label: 'Super Admin' },
]

export const demoProfiles = {
  super_admin: { name: 'Tim IT SADEWA', program: null, faculty: null, code: null },
  admin: { name: 'Budi Santoso', program: 'Teknik Komputer', faculty: 'Fakultas Teknik', code: 'TK' },
  dosen: { name: 'Andi Pratama', program: 'Teknik Komputer', faculty: 'Fakultas Teknik', code: 'TK' },
  kaprodi: { name: 'Dr. Bima', program: 'Teknik Komputer', faculty: 'Fakultas Teknik', code: 'TK' },
  dekan: { name: 'Prof. Citra', program: 'Fakultas Teknik', faculty: 'Fakultas Teknik', code: 'FT' },
}

export const sidebarMenus = {
  admin: [
    { label: 'Ikhtisar', path: '/dashboard' },
    { label: 'Analitik OBE', path: '/analisis' },
    { label: 'Kurikulum OBE', path: '/kurikulum' },
    { label: 'Laporan Saya', path: '/dokumen' },
    { label: 'Manajemen Pengguna', path: '/pengaturan' },
  ],
  dosen: [
    { label: 'Ikhtisar', path: '/dashboard' },
    { label: 'Analitik OBE', path: '/analisis' },
    { label: 'Kurikulum OBE', path: '/kurikulum', suffix: 'Read only' },
    { label: 'Laporan Saya', path: '/dokumen' },
  ],
  kaprodi: [
    { label: 'Ikhtisar', path: '/dashboard' },
    { label: 'Analitik OBE', path: '/analisis' },
    { label: 'Kurikulum OBE', path: '/kurikulum' },
    { label: 'Validasi Laporan', path: '/dokumen' },
  ],
  dekan: [
    { label: 'Ikhtisar', path: '/dashboard' },
    { label: 'Analitik OBE', path: '/analisis' },
    { label: 'Validasi Laporan', path: '/dokumen' },
  ],
  super_admin: [
    { label: 'Daftar Prodi', path: '/super-admin' },
    { label: 'Pengajuan Onboarding', path: '/super-admin', badge: '2' },
    { label: 'Manajemen Pengguna Lintas Prodi', path: '/super-admin' },
  ],
}

export const demoDashboard = {
  program: 'Teknik Komputer',
  faculty: 'Fakultas Teknik',
  semester: '2024 Genap',
  version: 'Kurikulum 2024 v1.3',
  lastSync: '18 Sep 2026 08:15',
  target: 70,
  overall: 79.6,
  students: 45,
  activeCourses: 12,
  pendingReports: 3,
}

export const demoCpl = [
  { code: 'CPL-A', name: 'Problem Solving', achievement: 81.5, trend: 8.4, students: '35/45 mahasiswa', status: 'Tercapai' },
  { code: 'CPL-B', name: 'Technical Skills', achievement: 68.0, trend: -4.2, students: '29/45 mahasiswa', status: 'Perlu Perhatian' },
  { code: 'CPL-C', name: 'Communication', achievement: 87.2, trend: 6.1, students: '39/45 mahasiswa', status: 'Tercapai' },
  { code: 'CPL-D', name: 'Professionalism', achievement: 76.8, trend: 3.4, students: '34/45 mahasiswa', status: 'Tercapai' },
  { code: 'CPL-E', name: 'Data Literacy', achievement: 72.4, trend: 2.1, students: '31/45 mahasiswa', status: 'Tercapai' },
  { code: 'CPL-F', name: 'Innovation', achievement: 69.8, trend: -1.6, students: '28/45 mahasiswa', status: 'Perlu Perhatian' },
]

export const demoCplOverview = [
  { code: 'CPL-A', name: 'Problem Solving', achievement: 81.5, target: 70, students: 35, status: 'ACHIEVED' },
  { code: 'CPL-B', name: 'Technical Skills', achievement: 68, target: 70, students: 29, status: 'WARNING' },
  { code: 'CPL-C', name: 'Communication', achievement: 87.2, target: 70, students: 39, status: 'ACHIEVED' },
  { code: 'CPL-D', name: 'Professionalism', achievement: 76.8, target: 70, students: 34, status: 'ACHIEVED' },
  { code: 'CPL-E', name: 'Data Literacy', achievement: 72.4, target: 70, students: 31, status: 'ACHIEVED' },
  { code: 'CPL-F', name: 'Innovation', achievement: 69.8, target: 70, students: 28, status: 'WARNING' },
]

export const demoLatestActivities = [
  { time: '08:15', text: 'Kaprodi meninjau laporan Evaluasi RPS IF301.' },
  { time: '07:40', text: '4 CPMK baru dipetakan ke CPL-A dan CPL-C.' },
  { time: 'Kemarin', text: 'Dosen Andi mengirim laporan evaluasi semester berjalan.' },
]

export const demoCplBars = [
  { name: 'CPL-A', value: 81.5, target: 70 },
  { name: 'CPL-B', value: 68, target: 70 },
  { name: 'CPL-C', value: 87.2, target: 70 },
  { name: 'CPL-D', value: 76.8, target: 70 },
  { name: 'CPL-E', value: 72.4, target: 70 },
  { name: 'CPL-F', value: 69.8, target: 70 },
]

export const demoIkRows = [
  { code: 'IK-A1', name: 'Menganalisis kebutuhan sistem', progress: 84, achieved: 32, supporting: 'CPMK-IF301-1, CPMK-IF301-2' },
  { code: 'IK-A2', name: 'Merancang solusi berbasis data', progress: 77, achieved: 31, supporting: 'CPMK-IF302-1, CPMK-IF302-3' },
  { code: 'IK-B1', name: 'Menerapkan tooling industri', progress: 68, achieved: 29, supporting: 'CPMK-IF303-1' },
  { code: 'IK-C1', name: 'Mempresentasikan temuan akademik', progress: 89, achieved: 40, supporting: 'CPMK-IF304-1, CPMK-IF304-2' },
]

export const demoTrend = [
  { year: '2021', cplA: 62, cplB: 64, cplC: 71 },
  { year: '2022', cplA: 66, cplB: 63, cplC: 75 },
  { year: '2023', cplA: 74, cplB: 66, cplC: 82 },
  { year: '2024', cplA: 81, cplB: 68, cplC: 87 },
]

export const demoTrendInsights = [
  { title: 'CPL-A', text: 'Naik 20% sejak 2021' },
  { title: 'CPL-B', text: 'Turun 4% · perlu review' },
  { title: 'CPL-C', text: 'Stabil di atas target' },
]

export const demoCurriculumStats = [
  { label: 'CPL', value: 8 },
  { label: 'IK', value: 35 },
  { label: 'CPMK', value: 60 },
  { label: 'Mata kuliah', value: 12 },
]

export const demoCurriculumRows = [
  { cpl: 'CPL-A', name: 'Problem Solving', ik: 5, cpmk: 12, status: 'Aktif' },
  { cpl: 'CPL-B', name: 'Technical Skills', ik: 6, cpmk: 14, status: 'Aktif' },
  { cpl: 'CPL-C', name: 'Communication', ik: 4, cpmk: 10, status: 'Aktif' },
  { cpl: 'CPL-D', name: 'Professionalism', ik: 5, cpmk: 9, status: 'Aktif' },
]

export const demoReportSummary = [
  { label: 'Pending review', value: 3 },
  { label: 'Disetujui bulan ini', value: 11 },
  { label: 'Arsip evaluasi', value: 28 },
]

export const demoReportRows = [
  { lecturer: 'Andi Pratama', course: 'IF301 - Struktur Data', date: '18 Sep 2026', status: 'Menunggu Validasi' },
  { lecturer: 'Siti Rahma', course: 'IF302 - Basis Data', date: '17 Sep 2026', status: 'Disetujui' },
  { lecturer: 'Fajar Hidayat', course: 'IF303 - Jaringan Komputer', date: '16 Sep 2026', status: 'Perlu Revisi' },
]

export const demoPrograms = [
  { name: 'Teknik Komputer', faculty: 'Fakultas Teknik', onboardedAt: '2024-07-04', activeUsers: 24, cplCount: 8, courseCount: 12 },
  { name: 'Teknik Lingkungan', faculty: 'Fakultas Sains', onboardedAt: '2024-08-20', activeUsers: 18, cplCount: 7, courseCount: 11 },
  { name: 'Statistika', faculty: 'Fakultas Matematika', onboardedAt: '2025-01-12', activeUsers: 15, cplCount: 9, courseCount: 10 },
]

export const demoProvisioningRequests = [
  { ref: 'REQ-240615-001', program: 'Teknik Lingkungan', requester: 'Rina A.', email: 'rina@contoh.ac.id', date: '15 Jun 2024', status: 'REVIEW' },
  { ref: 'REQ-240610-002', program: 'Statistika', requester: 'Dewi P.', email: 'dewi@contoh.ac.id', date: '10 Jun 2024', status: 'DISETUJUI' },
]

export function getRoleLabel(role) {
  return roleLabels[role] || 'Pengguna'
}

export function getRoleProgram(role) {
  return demoProfiles[role]?.code || null
}

export function getMenuItems(role) {
  return sidebarMenus[role] || sidebarMenus.admin
}
