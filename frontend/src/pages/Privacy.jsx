import React from "react";

export default function Privacy() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#17152c",
        color: "white",
        padding: "60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "auto",
          background: "#22203f",
          padding: "40px",
          borderRadius: "16px",
        }}
      >
        <h1 style={{ color: "#8B5CF6" }}>Privacy Policy</h1>

        <p>Last Updated: July 14, 2026</p>

        <p>
          Welcome to Mattchat. We value your privacy and are committed to
          protecting your personal information.
        </p>

        <h2>Information We Collect</h2>

        <ul>
          <li>Email address</li>
          <li>Profile information</li>
          <li>Messages you choose to store</li>
          <li>Information from connected services like Pinterest and Spotify</li>
        </ul>

        <h2>How We Use Your Information</h2>

        <ul>
          <li>Provide Mattchat services</li>
          <li>Authenticate users</li>
          <li>Improve AI features</li>
          <li>Enable third-party integrations</li>
          <li>Improve security</li>
        </ul>

        <h2>Third-Party Services</h2>

        <p>
          Mattchat may integrate with services including Pinterest, Spotify,
          Google, GitHub and other providers. Their privacy policies also apply
          when you connect those accounts.
        </p>

        <h2>Data Security</h2>

        <p>
          We use reasonable measures to protect your information from
          unauthorized access.
        </p>

        <h2>Your Rights</h2>

        <p>
          You may disconnect connected services or request deletion of your
          account at any time.
        </p>

        <h2>Contact</h2>

        <p>
          Email: mattchat.app@gmail.com
        </p>
      </div>
    </div>
  );
}
