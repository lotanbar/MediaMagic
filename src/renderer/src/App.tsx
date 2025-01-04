import FileView from './comps/FileView'
import ActionPane from './comps/ActionPane'

export default function App(): JSX.Element {
  return (
    <div className="w-screen h-screen">
      <FileView />
      <ActionPane />
    </div>
  )
}
