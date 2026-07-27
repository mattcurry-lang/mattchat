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
  },
  updated: {
    color: "#CBD5E1",
    marginBottom: "35px",
  },
  h2: {
    color: "#C084FC",
    marginTop: "35px",
  },
  p: {
    lineHeight: 1.8,
    color: "#E2E8F0",
  },
  li: {
    lineHeight: 1.8,
    color: "#E2E8F0",
    marginBottom: "10px",
  },
};

export default function Terms() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Terms of Service</h1>

        <p style={styles.updated}>
          <strong>Last Updated:</strong> July 27, 2026
        </p>

        <p style={styles.p}>
          These Terms of Service govern your use of Mattchat. By accessing or
          using Mattchat, you agree to these Terms.
        </p>

        <h2 style={styles.h2}>1. Eligibility</h2>

        <p style={styles.p}>
          You must comply with applicable laws and be legally eligible to use
          this service in your jurisdiction.
        </p>

        <h2 style={styles.h2}>2. Your Account</h2>

        <ul>
          <li style={styles.li}>Keep your login credentials secure.</li>
          <li style={styles.li}>
            You are responsible for activity under your account.
          </li>
          <li style={styles.li}>
            Notify us immediately of unauthorized access.
          </li>
        </ul>

        <h2 style={styles.h2}>3. Acceptable Use</h2>

        <ul>
          <li style={styles.li}>Follow all applicable laws.</li>
          <li style={styles.li}>Do not harass other users.</li>
          <li style={styles.li}>Do not upload malicious software.</li>
          <li style={styles.li}>Do not misuse AI features.</li>
          <li style={styles.li}>
            Respect the terms of connected third-party platforms.
          </li>
        </ul>

        <h2 style={styles.h2}>4. AI Services</h2>

        <p style={styles.p}>
          Mattchat includes AI-powered capabilities. AI-generated responses
          may contain errors or inaccuracies and should not be relied upon as
          professional advice.
        </p>

        <h2 style={styles.h2}>5. Third-Party Integrations</h2>

        <p style={styles.p}>
          Mattchat may integrate with services including Google, GitHub,
          Spotify, Pinterest, TikTok, YouTube, and others. Your use of those
          services is also governed by their own terms and policies.
        </p>

        <h2 style={styles.h2}>6. Intellectual Property</h2>

        <p style={styles.p}>
          Mattchat, including its branding, software, design, and features,
          is protected by intellectual property laws. You retain ownership of
          content you create and upload.
        </p>

        <h2 style={styles.h2}>7. Service Availability</h2>

        <p style={styles.p}>
          Mattchat may be updated, modified, or discontinued without prior
          notice. We do not guarantee uninterrupted availability.
        </p>

        <h2 style={styles.h2}>8. Limitation of Liability</h2>

        <p style={styles.p}>
          To the maximum extent permitted by law, Mattchat shall not be liable
          for indirect, incidental, or consequential damages arising from the
          use of the service.
        </p>

        <h2 style={styles.h2}>9. Termination</h2>

        <p style={styles.p}>
          We may suspend or terminate accounts that violate these Terms or
          applicable laws. Users may delete their accounts at any time.
        </p>

        <h2 style={styles.h2}>10. Changes</h2>

        <p style={styles.p}>
          These Terms may be updated periodically. Continued use of Mattchat
          after changes are published constitutes acceptance of the updated
          Terms.
        </p>

        <h2 style={styles.h2}>11. Contact</h2>

        <p style={styles.p}>
          Email: <strong>mattchat.app@gmail.com</strong>
        </p>
      </div>
    </div>
  );
}
