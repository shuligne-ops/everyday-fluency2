import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Retrieval Lab — версия B',
  description: 'Contrastive Activation Ladder experiment',
}

export default function Page() {
  redirect('/retrieval-lab-v6/colleague')
}
