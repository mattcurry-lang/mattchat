import React from "react";

export default function Terms() {
  return (
    <div className="legal-page">

      <div className="legal-container">

        <header className="legal-header">
          <h1>Mattchat</h1>
          <p>Terms of Service</p>
        </header>


        <main className="legal-card">

          <h2>Terms of Service</h2>

          <p className="updated">
            Last Updated: July 27, 2026
          </p>


          <p>
            Welcome to <strong>Mattchat</strong>. These Terms of Service
            explain the rules and conditions for using Mattchat and its
            AI-powered features.
          </p>


          <p>
            By accessing or using Mattchat, you agree to these Terms. If you
            do not agree with these Terms, please do not use the service.
          </p>


          <h3>1. Eligibility</h3>

          <p>
            You must be legally allowed to use online services in your
            location and comply with all applicable laws and regulations.
          </p>


          <h3>2. Creating an Account</h3>

          <p>
            When creating an account, you agree to provide accurate
            information and keep your account credentials secure.
          </p>

          <ul>
            <li>You are responsible for activity under your account.</li>
            <li>
              You should notify us if you suspect unauthorized access.
            </li>
            <li>
              You must not share your account in a way that compromises
              security.
            </li>
          </ul>


          <h3>3. Acceptable Use</h3>

          <p>
            When using Mattchat, you agree not to:
          </p>

          <ul>
            <li>Use the service for illegal activities.</li>
            <li>Attempt unauthorized access to systems.</li>
            <li>Upload malicious files or software.</li>
            <li>Abuse, harass, or harm other users.</li>
            <li>Misuse AI-generated content.</li>
            <li>Violate third-party platform policies.</li>
          </ul>


          <h3>4. AI Features</h3>

          <p>
            Mattchat includes AI-powered features such as Curry AI, content
            analysis, summaries, translations, and productivity assistance.
          </p>

          <p>
            AI-generated responses may not always be accurate. Users should
            verify important information before relying on AI-generated
            content.
          </p>


          <h3>5. Third-Party Integrations</h3>

          <p>
            Mattchat may integrate with third-party services including
            Google, GitHub, TikTok, YouTube, Pinterest, Spotify, and other
            supported platforms.
          </p>

          <p>
            Your use of those services is also subject to their own terms,
            privacy policies, and rules.
          </p>


          <h3>6. User Content</h3>

          <p>
            You retain ownership of content you create, upload, or share
            through Mattchat.
          </p>

          <p>
            You are responsible for ensuring that your content does not
            violate any laws, copyrights, or third-party rights.
          </p>


          <h3>7. Intellectual Property</h3>

          <p>
            Mattchat, including its software, branding, designs, features,
            and technology, belongs to Mattchat and is protected by
            applicable intellectual property laws.
          </p>


          <h3>8. Service Availability</h3>

          <p>
            We continuously improve Mattchat and may update, modify, suspend,
            or discontinue certain features when necessary.
          </p>

          <p>
            We do not guarantee that the service will always be available
            without interruptions.
          </p>


          <h3>9. Privacy</h3>

          <p>
            Your use of Mattchat is also governed by our Privacy Policy,
            which explains how we collect and protect your information.
          </p>


          <h3>10. Account Termination</h3>

          <p>
            We may restrict or terminate accounts that violate these Terms,
            harm other users, or misuse Mattchat services.
          </p>

          <p>
            Users may stop using Mattchat or request account deletion at any
            time.
          </p>


          <h3>11. Limitation of Liability</h3>

          <p>
            To the maximum extent permitted by law, Mattchat is not
            responsible for indirect damages, losses, or issues resulting
            from the use of the service.
          </p>


          <h3>12. Changes To These Terms</h3>

          <p>
            We may update these Terms from time to time. Continued use of
            Mattchat after changes are published means you accept the
            updated Terms.
          </p>


          <h3>13. Contact</h3>

          <p>
            For questions regarding these Terms, contact:
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
