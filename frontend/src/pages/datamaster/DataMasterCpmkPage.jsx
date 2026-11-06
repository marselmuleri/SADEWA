import { useOutletContext } from 'react-router-dom'
import PageErrorBoundary from '../../components/PageErrorBoundary'
import DataMasterPage from './DataMasterPage'

export default function DataMasterCpmkPage() {
  const { section, data } = useOutletContext()
  return <PageErrorBoundary><DataMasterPage section={section} data={data} /></PageErrorBoundary>
}
