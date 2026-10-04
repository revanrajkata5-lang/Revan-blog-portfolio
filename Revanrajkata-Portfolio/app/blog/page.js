import Navbar from '../../components/Navbar';
import SmoothScroll from '../../components/SmoothScroll';
import { BlogList } from '../../components/Blog';

export const metadata = { title: 'Blog — REVANRAJ KATA', description: 'Daily writing by Revanraj Kata: projects, learning notes and journal entries.' };

export default function BlogPage() {
  return (<><SmoothScroll /><Navbar /><BlogList /></>);
}
