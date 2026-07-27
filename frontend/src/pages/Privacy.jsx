import React from "react";

export default function Privacy() {
  return (
    <div className="legal-page">

      <div className="legal-container">

        <header className="legal-header">
          <h1>Mattchat</h1>
          <p>Privacy Policy</p>
        </header>


        <main className="legal-card">

          <h2>Privacy Policy</h2>

          <p className="updated">
            Last Updated: July 27, 2026
          </p>


          <p>
            Welcome to <strong>Mattchat</strong>. We respect your privacy and
            are committed to protecting your personal information. This Privacy
            Policy explains how we collect, use, and protect your information
            when you use Mattchat.
          </p>


          <h3>1. Information We Collect</h3>

          <ul>
            <li>Email address</li>
            <li>Name and profile information</li>
            <li>Profile picture</li>
            <li>Messages you choose to store</li>
            <li>AI conversations</li>
            <li>Uploaded files and documents</li>
            <li>Connected account information</li>
            <li>Device and browser information</li>
          </ul>


          <h3>2. Connected Services</h3>

          <p>
            Mattchat may connect with services including Google, GitHub,
            Pinterest, Spotify, TikTok, YouTube, and other supported platforms.
            We only access information that you authorize.
          </p>


          <h3>3. How We Use Your Information</h3>

          <ul>
            <li>Provide Mattchat services</li>
            <li>Authenticate users</li>
            <li>Enable AI features</li>
            <li>Improve performance</li>
            <li>Maintain security</li>
            <li>Develop new features</li>
          </ul>


          <h3>4. AI Processing</h3>

          <p>
            Mattchat uses artificial intelligence to provide features such as
            summarization, assistance, translation, analysis, and productivity
            tools. Information submitted to AI features is processed only to
            provide the requested service.
          </p>


          <h3>5. Data Security</h3>

          <p>
            We use reasonable security measures to protect your information.
            However, no online service can guarantee complete security.
          </p>


          <h3>6. Data Sharing</h3>

          <p>
            We do not sell your personal information. Information may only be
            shared with trusted service providers required to operate Mattchat,
            comply with legal requirements, or when you provide permission.
          </p>


          <h3>7. Your Rights</h3>

          <ul>
            <li>Request access to your information</li>
            <li>Request deletion of your account</li>
            <li>Disconnect connected services</li>
            <li>Update your information</li>
          </ul>


          <h3>8. Changes To This Policy</h3>

          <p>
            We may update this Privacy Policy periodically. Updates will be
            reflected by changing the Last Updated date.
          </p>


          <h3>9. Contact</h3>

          <p>
            Email:
            <br />
            <strong>mattchat.app@gmail.com</strong>
          </p>


        </main>

      </div>


      <style>{`

        html,
        body,
        #root {
          min-height:100%;
          overflow-y:auto;
          overflow-x:hidden;
        }


        .legal-page {

          min-height:100vh;
          height:auto;

          background:
          linear-gradient(
          135deg,
          #120F25,
          #1B1736,
          #2B1F5F
          );

          padding:40px 20px;

          color:white;

          font-family:
          Inter,
          Arial,
          sans-serif;

        }



        .legal-container {

          max-width:1000px;
          margin:auto;

        }



        .legal-header {

          text-align:center;
          margin-bottom:30px;

        }


        .legal-header h1 {

          color:#A855F7;
          font-size:42px;

          margin:0;

        }


        .legal-header p {

          color:#CBD5E1;
          font-size:18px;

        }



        .legal-card {

          background:
          rgba(255,255,255,0.08);

          backdrop-filter:
          blur(20px);

          border:
          1px solid rgba(255,255,255,0.15);


          border-radius:25px;

          padding:45px;

          box-shadow:
          0 20px 60px rgba(0,0,0,.35);


          line-height:1.8;

        }



        .legal-card h2 {

          color:#C084FC;

          font-size:32px;

        }


        .legal-card h3 {

          color:#A855F7;

          margin-top:35px;

        }


        .legal-card p,
        .legal-card li {

          color:#E2E8F0;

        }


        .updated {

          color:#94A3B8!important;

        }



        @media(max-width:700px){

          .legal-card{

            padding:25px;

          }

          .legal-header h1{

            font-size:32px;

          }

        }


      `}</style>


    </div>
  );
}
