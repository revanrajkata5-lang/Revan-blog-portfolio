import Navbar from '../../components/Navbar';
import Contact from '../../components/Contact';
import SmoothScroll from '../../components/SmoothScroll';

export const metadata = {
  title: 'Contact — REVANRAJ KATA',
  description: 'Get in touch with Revanraj Kata for projects, internships and questions.',
};

export default function ContactPage() {
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <Contact variant="page" />
    </>
  );
}
