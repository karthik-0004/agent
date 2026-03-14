import { useEffect, useState } from 'react';

const tagline = 'Autonomous workflow orchestration for modern teams.';

const IntroScreen = ({ onEnter }) => {
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(tagline.slice(0, index));
      if (index >= tagline.length) {
        window.clearInterval(timer);
      }
    }, 32);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="intro-screen">
      <div className="intro-glow intro-glow-left" />
      <div className="intro-glow intro-glow-right" />
      <div className="intro-content">
        <div className="intro-logo-wrap">
          <div className="intro-logo">N</div>
          <h1 className="intro-title">Neurax</h1>
        </div>
        <p className="intro-tagline">{visibleText}<span className="type-cursor">|</span></p>
        <button type="button" className="intro-button" onClick={onEnter}>
          Enter Workspace
        </button>
      </div>
    </div>
  );
};

export default IntroScreen;
