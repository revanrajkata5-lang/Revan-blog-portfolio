import Preloader from '../components/Preloader';
import Hero from '../components/Hero';
import Projects from '../components/Projects';
import HomeSkills from '../components/HomeSkills';
import { LatestWriting } from '../components/Blog';
import Contact from '../components/Contact';
import Navbar from '../components/Navbar';
import SmoothScroll from '../components/SmoothScroll';

export default function Home() {
  return (
    <>
      <Preloader />
      <SmoothScroll />
      <Navbar />
      <Hero />
      <Projects />
      <HomeSkills />
      <LatestWriting />
      <Contact />
    </>
  );
}
