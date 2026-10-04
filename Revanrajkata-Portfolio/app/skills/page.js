import Navbar from '../../components/Navbar';
import Skills from '../../components/Skills';
import SmoothScroll from '../../components/SmoothScroll';

export const metadata = {
  title: 'Skills & Resume — REVANRAJ KATA',
  description: 'Skills, experience, projects and education of Revanraj Kata, a CSE (Data Science) student building full-stack web applications.',
};

export default function SkillsPage() {
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <Skills />
    </>
  );
}
