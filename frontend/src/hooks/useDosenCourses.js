import { useContext } from 'react'
import { DosenCoursesContext } from '../context/DosenCoursesContext'

export default function useDosenCourses() {
  const context = useContext(DosenCoursesContext)
  if (!context) {
    throw new Error('useDosenCourses must be used within a DosenCoursesProvider')
  }
  return context
}
