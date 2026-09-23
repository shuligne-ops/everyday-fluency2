import Trainer from '../Trainer'

export const metadata = {
  title: 'Retrieval Lab V5 — версия A',
  description: 'Visible-target execution trainer',
}

export default function Page() {
  return <Trainer mode="ours" />
}
