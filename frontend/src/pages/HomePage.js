import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Button, Card, Carousel } from 'react-bootstrap';
import {
  FaHome,
  FaHandsHelping,
  FaHeart,
  FaUsers,
  FaCalendarAlt,
  FaDonate,
  FaUserShield,
  FaEnvelope,
  FaPhoneAlt,
  FaMapMarkerAlt
} from 'react-icons/fa';
import '../styles/HomePage.css';

const HomePage = () => {
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [keySequence, setKeySequence] = useState([]);
  
  //Staff secret code keyboard
  const secretCode = ['s', 't', 'a', 'f', 'f'];
  const [keyPressed, setKeyPressed] = useState({});

  useEffect(() => {
    const handleKeySequence = (e) => {
      const key = e.key.toLowerCase();
      
      const newSequence = [...keySequence, key];
      
      if (newSequence.length > secretCode.length) {
        newSequence.shift();
      }
      
      setKeySequence(newSequence);
      
      if (newSequence.join('') === secretCode.join('')) {
        setShowStaffLogin(true);
        console.log('Staff login revealed!');
        setKeySequence([]);
      }
    };

    const handleKeyCombination = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault(); 
        setShowStaffLogin(prev => !prev); 
      }
    };

    // event listeners
    window.addEventListener('keydown', handleKeySequence);
    window.addEventListener('keydown', handleKeyCombination);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeySequence);
      window.removeEventListener('keydown', handleKeyCombination);
    };
  }, [keySequence, secretCode]); 
  const handleSecretAreaClick = () => {
    setShowStaffLogin(true);
  };

  const services = [
    {
      icon: <FaHome />,
      title: 'Residential Care & Shelter',
      description:
        'We provide a safe, clean, and comfortable living environment for elderly residents who need long-term care and support.'
    },
    {
      icon: <FaHeart />,
      title: 'Daily Needs & Medical Support',
      description:
        'Our residents receive daily assistance, health monitoring, and medical coordination to ensure their well-being.'
    },
    {
      icon: <FaHandsHelping />,
      title: 'Spiritual Guidance & Companionship',
      description:
        'Emotional support, spiritual guidance, and compassionate companionship are at the heart of our mission.'
    },
    {
      icon: <FaUsers />,
      title: 'Community & Engagement',
      description:
        'We organize activities and community programs that bring joy, purpose, and connection to our elderly.'
    }
  ];

  return (
    <div className="home-page">

      {!showStaffLogin && (
        <div 
          style={{ display: 'none' }} 
          onClick={handleSecretAreaClick}
        />
      )}

      {/* Her Section */}
      <section className="hero-section text-center text-white">
        <Container>
          <p className="hero-subtitle">
            Little Sisters of the Abandoned Elderly
          </p>

          <h1 className="hero-title mb-4">
            “Caring for the Elderly with <br /> Love and Dignity”
          </h1>

          <p className="hero-description mb-4">
            Run by devoted souls, we provide shelter, care, and hope for elderly
            individuals who have nowhere else to turn.
          </p>

          {/* BUTTONS */}
          <div className="hero-buttons">
            <Link to="/booking">
              <Button variant="light" size="lg">
                Book a Visit
              </Button>
            </Link>

            <Link to="/donation">
              <Button variant="outline-light" size="lg">
                Make a Donation
              </Button>
            </Link>

            {showStaffLogin && (
              <Link to="/login">
                <Button variant="primary" size="lg">
                  Staff Login
                </Button>
              </Link>
            )}
          </div>
        </Container>
      </section>

      
      <section className="intro-section">
        <Container className="text-center">
          <h3>Welcome to</h3>
          <h2>Little Sisters of the Abandoned Elderly</h2>
          <p>
            Run by devoted souls, we provide shelter, care, and hope for elderly
            individuals who have nowhere else to turn.
          </p>
        </Container>
      </section>

      {/* ABOUT */}
      <section className="about-section">
        <Container>
          <Row>
            <Col md={12}>
              <h2 className="section-title">About Us</h2>
              <p>
                For years, the Little Sisters of the Abandoned Elderly have
                dedicated their lives to serving the poor, the sick, and the
                abandoned elderly. We believe that every senior deserves to live
                with dignity, respect, and love.
              </p>
              <p>
                Guided by compassion and faith, our mission goes beyond physical
                care. We nurture emotional well-being, foster spiritual growth,
                and create a true home for those entrusted to us.
              </p>
            </Col>
          </Row>
        </Container>
      </section>

      {/* SERVICES */}
      <section className="services-section">
        <Container>
          <h2 className="section-title text-center">Our Core Services</h2>
          <Row>
            {services.map((service, index) => (
              <Col md={3} key={index}>
                <Card className="service-card">
                  <Card.Body>
                    <div className="service-icon">{service.icon}</div>
                    <Card.Title>{service.title}</Card.Title>
                    <Card.Text>{service.description}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* GALLERY */}
      <section className="gallery-section">
        <Container>
          <h2 className="section-title text-center">
            Catch a glimpse of moments in LSAE
          </h2>

          <Carousel>
            <Carousel.Item>
              <img
                className="d-block w-100"
                src="/images/pic.jpg"
                alt="LSAE Moment"
              />
            </Carousel.Item>

            <Carousel.Item>
              <img
                className="d-block w-100"
                src="/images/pic1.jpg"
                alt="LSAE Moment"
              />
            </Carousel.Item>

            <Carousel.Item>
              <img
                className="d-block w-100"
                src="/images/pic2.jpg"
                alt="LSAE Moment"
              />
            </Carousel.Item>
          </Carousel>
        </Container>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <Container className="text-center">
          <h2>Create connections with LSAE.</h2>
        </Container>
      </section>

      {/* FOOTER */}
      <footer className="footer-section">
        <Container>
          <Row>
            <Col md={4}>
              <h5>Contact Us</h5>
              <p><FaMapMarkerAlt /> 153 F Blumentritt St. San Juan, Philippines</p>
              <p><FaPhoneAlt /> 0906 948 9219</p>
              <p><FaEnvelope /> hermanitasmanila@gmail.com</p>
            </Col>

            <Col md={4}>
              <h5>Quick Links</h5>
              <Link to="/">Home</Link><br />
              <Link to="/booking">Booking</Link><br />
              <Link to="/donation">Donation</Link><br />
              {/* Staff Login link also hidden */}
              {showStaffLogin && (
                <>
                  <Link to="/login">Staff Login</Link><br />
                </>
              )}
            </Col>

            <Col md={4}>
              <h5>Access</h5>
              <p><FaCalendarAlt /> Visit Scheduling</p>
              <p><FaDonate /> Donations</p>
              {/* Staff Portal also hidden */}
              {showStaffLogin && (
                <p><FaUserShield /> Staff Portal</p>
              )}
            </Col>
          </Row>
        </Container>
      </footer>
    </div>
  );
};

export default HomePage;