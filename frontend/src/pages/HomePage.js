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
  FaMapMarkerAlt,
  FaFacebook,
  FaHandHoldingHeart,
  FaBrain,
  FaChurch,
  FaBed,
  FaShieldAlt,
  FaStethoscope,
  FaCross,
  FaDoorOpen,
  FaTree,
  FaParking,
  FaUtensils,
  FaBookOpen,
  FaCouch,
  FaUserMd,
  FaDove,
  FaBullseye,
  FaFlag,
  FaQuoteLeft,
  FaArrowUp
} from 'react-icons/fa';
import '../styles/HomePage.css';
import theSistersImg from '../assets/TheSisters.png';
import lifeAtLSAEImg from '../assets/LifeAtLSAE.png';
import lifeAtLSAE1Img from '../assets/LifeAtLSAE1.png';
import lifeAtLSAE2Img from '../assets/LifeAtLSAE2.png';

const HomePage = () => {
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [keySequence, setKeySequence] = useState([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  //Staff secret code keyboard
  const secretCode = ['s', 't', 'a', 'f', 'f'];
  const [keyPressed, setKeyPressed] = useState({});

  // Handle back to top button visibility on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
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

  // Detailed programs & services (from LSAE brochure)
  const detailedServices = [
    {
      icon: <FaHandHoldingHeart />,
      letter: 'A',
      title: 'Social Services',
      description:
        'Comprehensive assessment, planning, and tailored interventions to strengthen elderly welfare and social functioning, including assistance with SSS, PhilHealth, and OSCA benefits.'
    },
    {
      icon: <FaBrain />,
      letter: 'B',
      title: 'Psychological Services',
      description:
        'Therapeutic activities addressing emotional and mental health, including social support, cognitive stimulation, arts and crafts, and music therapy.'
    },
    {
      icon: <FaChurch />,
      letter: 'C',
      title: 'Spiritual Service',
      description:
        'Daily masses, rosary sessions, and Bible studies that nurture the spiritual journey, personal growth, and overall well-being of our elders.'
    },
    {
      icon: <FaBed />,
      letter: 'D',
      title: 'Home Life Service',
      description:
        'A homely atmosphere with food, clothing, medication, shelter, and nursing care for residents who need assistance due to senility, disability, or bedridden conditions.'
    },
    {
      icon: <FaShieldAlt />,
      letter: 'E',
      title: 'Security Service',
      description:
        'Round-the-clock security measures, regular patrols, and swift emergency response protocols to keep residents and staff safe.'
    },
    {
      icon: <FaStethoscope />,
      letter: 'F',
      title: 'Health & Medical Services',
      description:
        'Consultations, treatments, medical referrals, hospitalizations, emergency response, laboratory services, and structured exercise programs.'
    },
    {
      icon: <FaCross />,
      letter: 'G',
      title: 'Burial Service',
      description:
        'Dignified and compassionate handling of burial arrangements for elderly individuals who are abandoned or lack familial support.'
    }
  ];

  // Institution facilities
  const facilities = [
    { icon: <FaDoorOpen />, name: 'Lobby' },
    { icon: <FaChurch />, name: 'Chapel' },
    { icon: <FaTree />, name: 'Grotto Garden' },
    { icon: <FaUsers />, name: 'Visitors Room' },
    { icon: <FaParking />, name: 'Parking' },
    { icon: <FaUtensils />, name: 'Kitchen' },
    { icon: <FaUtensils />, name: 'Dining Room' },
    { icon: <FaUserMd />, name: "Doctor's Room" },
    { icon: <FaCouch />, name: 'Parlor' },
    { icon: <FaBed />, name: 'Bedroom' },
    { icon: <FaBookOpen />, name: 'Library' },
    { icon: <FaCouch />, name: 'Living Room' }
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
            “Caring for the Elderly with Love and Dignity”
          </p>

          <h1 className="hero-title mb-4">
            Little Sisters of the <br /> Abandoned Elderly
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

      {/* BRIEF HISTORY */}
      <section className="history-section">
        <Container>
          <Row className="align-items-center">
            <Col md={12}>
              <h2 className="section-title">Brief History</h2>
              <p>
                The Little Sisters of the Abandoned Elderly originated in Barbastro, Spain
                on January 27, 1873, founded by St. Teresa de Jesus Jornet e Ibars and
                Venerable Fr. Saturnino Lopez Novoa, two Spaniards who shared the same
                dream of caring for the abandoned elderly.
              </p>
              <p>
                In the Philippines, the congregation is also known as the "St. Teresa
                Jornet Home." It became a reality when the first five Sisters arrived in
                the country in November 2006, full of enthusiasm to share their charism
                and mission with the Filipino people. After learning the language and way
                of life of the people, they envisioned a simple, comfortable place with
                the atmosphere of a true "Home" where the elderly could spend the autumn
                of their lives in peace, well cared for — open especially to the poor and
                to those who suffer not from poverty, but from loneliness.
              </p>
              <p>
                LSAE provides a holistic approach and residential care for the homeless,
                poor, sick, abandoned, neglected, and street-dwelling elderly — attending
                not only to their material needs, but to their spiritual needs as well, so
                that they may feel the love of God through every program and service.
              </p>
            </Col>
          </Row>
        </Container>
      </section>

      {/* MISSION, VISION & GOAL */}
      <section className="mission-vision-section">
        <Container>
          <Row>
            <Col md={4} className="mb-4">
              <div className="mv-card">
                <div className="mv-icon"><FaHeart /></div>
                <h3>Mission</h3>
                <p>
                  To take care of the elderly — "caring for the bodies in order to save
                  their souls" — by giving comfort and love to hopeless hearts, extending
                  compassion where it's most needed, and providing a sense of fulfillment
                  and a safe harbor for those who feel lost and alone in a difficult world
                  of growing old.
                </p>
              </div>
            </Col>
            <Col md={4} className="mb-4">
              <div className="mv-card">
                <div className="mv-icon"><FaDove /></div>
                <h3>Vision</h3>
                <p>
                  LSAE is driven only by eagerness to care well for others. This vision is
                  attained through God's love, shown through continuous effort to help the
                  elderly. The Congregation focuses on the joy of helping — not seeking
                  rewards or recognition, but fulfilling the promise to make this world a
                  little more beautiful for those most in need.
                </p>
              </div>
            </Col>
            <Col md={4} className="mb-4">
              <div className="mv-card">
                <div className="mv-icon"><FaFlag /></div>
                <h3>Goal</h3>
                <p>
                  To provide programs and services where the elderly feel that they belong
                  and are accepted in a place they can call "Home" — through God's grace,
                  the guidance and presence of the Sisters and personnel, enjoying dignity
                  and a wholesome, quality life rather than despair.
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* OBJECTIVES */}
      <section className="objectives-section">
        <Container>
          <h2 className="section-title text-center">Our Objectives</h2>
          <Row>
            <Col md={6}>
              <ul className="objectives-list">
                <li><FaBullseye /> To create a "Better Together" community life for our beloved elders by making a new family.</li>
                <li><FaBullseye /> To provide rehabilitation services to sustain or enhance their physical, social, emotional, and mental functioning.</li>
                <li><FaBullseye /> To empower them and lift their souls through activities that foster a sense of belonging and reduce loneliness, abandonment, and neglect.</li>
              </ul>
            </Col>
            <Col md={6}>
              <ul className="objectives-list">
                <li><FaBullseye /> To carry out activities that use their abilities and strengths, aimed at being productive.</li>
                <li><FaBullseye /> To connect the elderly to other agencies and NGOs that can provide services responsive to their needs.</li>
                <li><FaBullseye /> To give employees field exposure and training to enhance their knowledge in providing quality service for the elderly.</li>
              </ul>
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

      {/* DETAILED PROGRAMS & SERVICES */}
      <section className="detail-services-section">
        <Container>
          <h2 className="section-title text-center">Programs & Services</h2>
          <p className="detail-services-intro text-center">
            Our Residential Care with Healthy Aging and Wellness Program is tailored to
            promote the physical, mental, and social well-being of the female elderly
            residing at the Home.
          </p>
          <Row>
            {detailedServices.map((item, index) => (
              <Col md={6} lg={4} key={index} className="mb-4">
                <div className="detail-service-card">
                  <div className="detail-service-letter">{item.letter}</div>
                  <div className="service-icon">{item.icon}</div>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* OUR INSTITUTION / FACILITIES */}
      <section className="facilities-section">
        <Container>
          <h2 className="section-title text-center">Our Institution</h2>
          <p className="facilities-intro text-center">
            A simple, comfortable place with the atmosphere of a true home.
          </p>
          <Row>
            {facilities.map((facility, index) => (
              <Col xs={6} md={3} key={index} className="mb-4">
                <div className="facility-card">
                  <div className="facility-icon">{facility.icon}</div>
                  <p>{facility.name}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* THE SISTERS */}
      <section className="sisters-section">
        <Container>
          <Row className="align-items-center">
            <Col md={7}>
              <h2 className="section-title">The Sisters</h2>
              <p>
                The Little Sisters of the Abandoned Elderly, though hailing from different
                countries, are dedicated to providing care and companionship to the lolas.
                Despite the language barrier, they demonstrate a genuine commitment to
                bridging the gap — diligently learning Tagalog to understand and connect
                with the lolas on a deeper level. Their love and care are evident in every
                daily interaction.
              </p>
              <p>
                Beyond the Little Sisters, a dedicated team of caregivers, volunteers,
                on-the-job trainees (OJTs), and social workers work tirelessly to ensure
                the well-being of the lolas — creating a supportive and nurturing
                environment where they feel cherished and cared for.
              </p>
            </Col>
            <Col md={5}>
              <div className="sisters-img-wrap">
                <img src={theSistersImg} alt="The Little Sisters of the Abandoned Elderly" />
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* ACTIVITIES */}
      <section className="activities-section">
        <Container>
          <h2 className="section-title text-center">Life at LSAE</h2>
          <p className="text-center activities-intro">
            Our grandmothers are bursting with creativity and vitality! Each day they
            enjoy exercise routines and lively zumba sessions, board games that stimulate
            their minds, craft and art projects, and singing and dancing — activities
            that keep them engaged and contribute to their overall well-being and
            happiness.
          </p>
          <Row className="activities-gallery">
            <Col md={4} className="mb-4">
              <div className="activity-img-wrap">
                <img src={lifeAtLSAEImg} alt="Life at LSAE" />
              </div>
            </Col>
            <Col md={4} className="mb-4">
              <div className="activity-img-wrap">
                <img src={lifeAtLSAE1Img} alt="Life at LSAE" />
              </div>
            </Col>
            <Col md={4} className="mb-4">
              <div className="activity-img-wrap">
                <img src={lifeAtLSAE2Img} alt="Life at LSAE" />
              </div>
            </Col>
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

      {/* SUPPORT / DONATION INFO */}
      <section className="support-section">
        <Container>
          <Row className="align-items-center">
            <Col md={7}>
              <h2 className="section-title">Share Your Heart, Share Your Support</h2>
              <p>
                Your generosity helps us provide shelter, medical care, and daily
                comfort to elderly women who have nowhere else to turn.
              </p>
              <div className="support-detail">
                <strong>BPI Account:</strong> 2541001533 (Little Sisters of the
                Abandoned Elderly, Inc.)
              </div>
              <div className="support-detail">
                <strong>GCash:</strong> 0977 694 2464 - Nelcy M.
              </div>
            </Col>
            <Col md={5}>
              <div className="support-quote">
                <FaQuoteLeft className="quote-icon" />
                <p>
                  "You will be enriched in every way so that you can be generous on
                  every occasion, and through us your generosity will result in
                  thanksgiving to God."
                </p>
                <span>— 2 Corinthians 9:11</span>
              </div>
            </Col>
          </Row>
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
              <p><FaMapMarkerAlt /> 153 F. Blumentritt St., cor. R. Pascual, Brgy. Tibagan, San Juan City</p>
              <p><FaPhoneAlt /> 0906 948 9219 / 0915 486 0911</p>
              <p><FaPhoneAlt /> (02) 7004 2480</p>
              <p><FaEnvelope /> hermanitasmanila@gmail.com</p>
              <p>
                <FaFacebook />{' '}
                <a
                  href="https://www.facebook.com/LittleSistersoftheAbandonedElderly"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Little Sisters of the Abandoned Elderly
                </a>
              </p>
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

      {/* BACK TO TOP BUTTON */}
      {showBackToTop && (
        <button 
          className="back-to-top-btn"
          onClick={scrollToTop}
          title="Back to top"
          aria-label="Back to top"
        >
          <FaArrowUp />
        </button>
      )}
    </div>
  );
};

export default HomePage;