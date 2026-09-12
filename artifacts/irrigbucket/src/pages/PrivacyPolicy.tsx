import { Link } from 'wouter';
import { Droplet, ArrowLeft } from 'lucide-react';

// The address shown to users for privacy enquiries and deletion requests.
// Change this to your real support/privacy inbox before publishing.
const CONTACT_EMAIL = 'support@irrigbucket.co.nz';
const BUSINESS_NAME = 'IrrigBucket';
const LAST_UPDATED = '3 July 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-3 tracking-tight">
        {title}
      </h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2" data-testid="link-home">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Droplet className="w-5 h-5 fill-primary" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-foreground">
                Irrig<span className="text-primary">Bucket</span>
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight text-foreground mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-2 text-muted-foreground leading-relaxed mb-10">
          <p>
            This Privacy Policy explains how {BUSINESS_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) collects, uses, and protects your information when you use the{' '}
            {BUSINESS_NAME} mobile app and website (together, the &ldquo;Service&rdquo;).{' '}
            {BUSINESS_NAME} helps irrigators and assessors run bucket tests and calculate the
            distribution uniformity of irrigation systems.
          </p>
          <p>
            You can use the core features of the app offline and without an account. You only need an
            account if you want to back up your reports and sync them across devices.
          </p>
        </div>

        <Section title="Information we collect">
          <p>We only collect the information needed to provide the Service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Account information.</strong> If you create an
              account, we collect your email address and (where you provide it) your name. This is
              used to authenticate you and back up your reports.
            </li>
            <li>
              <strong className="text-foreground">Assessment data you enter.</strong> The details you
              type into a test — such as farm name, assessor name, irrigator name or ID, irrigation
              system measurements, bucket volumes, and test dates.
            </li>
            <li>
              <strong className="text-foreground">Support messages.</strong> If you contact us or send
              feedback through the app, we keep the message and any contact details you include.
            </li>
          </ul>
          <p>
            We do <strong className="text-foreground">not</strong> collect your location, contacts,
            photos, or advertising identifiers, and we do not use any analytics, advertising, or
            third-party tracking technologies.
          </p>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide the Service — calculating test results and saving your reports.</li>
            <li>To back up your reports and sync them across your devices when you are signed in.</li>
            <li>To respond to your support requests and feedback.</li>
            <li>To keep the Service secure and working correctly.</li>
          </ul>
          <p>
            We do not sell your personal information, and we do not use it for advertising or
            third-party marketing.
          </p>
        </Section>

        <Section title="How your information is stored and protected">
          <p>
            Your reports are stored on your device first, so the app works fully offline. When you are
            signed in and online, your reports are backed up to our secure cloud database, provided by
            Supabase, our hosting and authentication provider.
          </p>
          <p>
            All data transmitted between the app and our servers is encrypted in transit using HTTPS.
            Your login session token is held in your device&rsquo;s secure storage. We restrict access
            to stored data to what is required to operate the Service.
          </p>
        </Section>

        <Section title="Sharing your information">
          <p>
            We share your information only with the service providers that make the app work — chiefly
            Supabase, which hosts our database and handles account authentication on our behalf. These
            providers process your data solely to provide their services to us.
          </p>
          <p>
            We may also disclose information if required to do so by law, or to protect the rights,
            safety, and security of our users and the Service.
          </p>
        </Section>

        <Section title="Data retention and deleting your account">
          <p>
            We keep your account information and reports for as long as your account is active. You are
            in control of your data:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Delete individual reports</strong> at any time from
              within the app.
            </li>
            <li>
              <strong className="text-foreground">Delete your entire account.</strong> In the mobile
              app, open the <em>Account</em> screen and choose{' '}
              <em>Delete account</em>. This permanently and irreversibly removes your account, all of
              your synced reports, and your personal information from our servers.
            </li>
          </ul>
          <p>
            You can also email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium underline">
              {CONTACT_EMAIL}
            </a>{' '}
            and we will delete your account and associated data on your behalf.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on where you live (including under the New Zealand Privacy Act 2020 and, where
            applicable, the EU/UK GDPR), you have the right to access the personal information we hold
            about you, ask us to correct it, and ask us to delete it. To exercise any of these rights,
            contact us using the details below.
          </p>
        </Section>

        <Section title="Children&rsquo;s privacy">
          <p>
            The Service is intended for use by farmers and irrigation professionals and is not directed
            at children. We do not knowingly collect personal information from children.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the
            &ldquo;Last updated&rdquo; date at the top of this page. Significant changes will be
            communicated within the Service where appropriate.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            If you have any questions about this Privacy Policy or how we handle your information,
            please contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <p className="text-sm text-muted-foreground border-t border-border/50 pt-8 mt-4">
          &copy; {new Date().getFullYear()} {BUSINESS_NAME}. All rights reserved.
        </p>
      </main>
    </div>
  );
}
