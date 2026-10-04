import Navbar from '../../../components/Navbar';
import SmoothScroll from '../../../components/SmoothScroll';
import { BlogPost } from '../../../components/Blog';

export const metadata = { title: 'Blog — REVANRAJ KATA' };

export default function PostPage() {
  return (<><SmoothScroll /><Navbar /><BlogPost /></>);
}
