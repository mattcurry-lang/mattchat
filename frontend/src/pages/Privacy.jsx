import React from "react";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #120F25 0%, #1B1736 45%, #2B1F5F 100%)",
    color: "#F8FAFC",
    fontFamily: "Inter, Arial, sans-serif",
    padding: "60px 20px",
  },
  card: {
    maxWidth: "1000px",
    margin: "0 auto",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "24px",
    padding: "50px",
    boxShadow: "0 20px 60px rgba(0,0,0,.35)",
  },
  h1: {
    color: "#A855F7",
    fontSize: "2.5rem",
    marginBottom: "10px",
  },
  updated: {
    color: "#CBD5E1",
    marginBottom: "35px",
  },
  h2: {
    color: "#C084FC",
    marginTop: "35px",
    marginBottom: "12px",
  },
  p: {
    color: "#E2E8F0",
    lineHeight: 1.8,
  },
  li: {
    marginBottom: "10px",
    color: "#E2E8F0",
    lineHeight: 1.8,
  },
};

export default function Privacy() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Privacy Policy</h1>

        <p style={styles.updated}>
          <strong>Last Updated:</strong> July 27, 2026
        </p>

        <p style={styles.p}>
          Welcome to <strong>Mattchat</strong>. Your privacy matters to us.
          This Privacy Policy explains how we collect, use, protect, and
          manage your information when you use Mattchat and its AI-powered
          services.
        </p>

        <h2 style={styles.h2}>1. Information We Collect</h2>

        <ul>
          <li style={styles.li}>Email address</li>
          <li style={styles.li}>Name and profile information</li>
          <li style={styles.li}>Profile photo</li>
          <li style={styles.li}>Authentication information</li>
          <li style={styles.li}>Messages you choose to store</li>
          <li style={styles.li}>AI conversations</li>
          <li style={styles.li}>Uploaded files and documents</li>
          <li style={styles.li}>Device and browser information</li>
          <li style={styles.li}>IP address and diagnostic logs</li>
          <li style={styles.li}>Notification preferences</li>
        </ul>

        <h2 style={styles.h2}>2. Connected Services</h2>

        <p style={styles.p}>
          Mattchat may integrate with services such as Google, GitHub,
          Pinterest, Spotify, TikTok, YouTube, and other supported providers.
          We only access information that you explicitly authorize through
          each provider's official authentication system.
        </p>

        <h2 style={styles.h2}>3. How We Use Your Information</h2>

        <ul>
          <li style={styles.li}>Provide Mattchat services</li>
          <li style={styles.li}>Authenticate your account</li>
          <li style={styles.li}>Power AI features</li>
          <li style={styles.li}>Synchronize connected accounts</li>
          <li style={styles.li}>Improve application performance</li>
          <li style={styles.li}>Improve security</li>
          <li style={styles.li}>Detect abuse and fraud</li>
          <li style={styles.li}>Develop new features</li>
        </ul>

        <h2 style={styles.h2}>4. AI Processing</h2>

        <p style={styles.p}>
          Mattchat includes AI-powered features that may summarize content,
          analyze documents, answer questions, translate text, and assist
          with productivity tasks. Content submitted to AI features is
          processed only to provide the requested functionality.
        </p>

        <h2 style={styles.h2}>5. Cookies & Local Storage</h2>

        <p style={styles.p}>
          Mattchat may use cookies, local storage, and similar technologies
          to maintain login sessions, remember preferences, improve security,
          and enhance performance.
        </p>

        <h2 style={styles.h2}>6. Data Sharing</h2>

        <p style={styles.p}>
          We do not sell your personal information. Information is shared
          only when necessary to provide Mattchat services, comply with legal
          obligations, protect our users, or with your explicit consent.
        </p>

        <h2 style={styles.h2}>7. Data Retention</h2>

        <p style={styles.p}>
          We retain your information only as long as necessary to provide our
          services, comply with legal obligations, resolve disputes, and
          enforce our agreements.
        </p>

        <h2 style={styles.h2}>8. Your Rights</h2>

        <ul>
          <li style={styles.li}>Access your information</li>
          <li style={styles.li}>Update your information</li>
          <li style={styles.li}>Delete your account</li>
          <li style={styles.li}>Disconnect connected services</li>
          <li style={styles.li}>Request deletion of stored information</li>
        </ul>

        <h2 style={styles.h2}>9. Security</h2>

        <p style={styles.p}>
          We use industry-standard technical and organizational measures to
          protect your information. However, no internet transmission or
          storage method is completely secure.
        </p>

        <h2 style={styles.h2}>10. Children's Privacy</h2>

        <p style={styles.p}>
          Mattchat is not intended for children under the minimum age
          required by applicable law. We do not knowingly collect personal
          information from children.
        </p>

        <h2 style={styles.h2}>11. Changes to this Policy</h2>

        <p style={styles.p}>
          We may update this Privacy Policy from time to time. Changes become
          effective when published on this page.
        </p>

        <h2 style={styles.h2}>12. Contact Us</h2>

        <p style={styles.p}>
          Email: <strong>mattchat.app@gmail.com</strong>
        </p>
      </div>
    </div>
  );
}
