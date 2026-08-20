<script setup lang="ts">
definePageMeta({ public: true, layout: 'portal' })
</script>

<template>
  <main class="saas-home">
    <section class="saas-home__hero">
      <div class="saas-home__copy">
        <p class="saas-home__eyebrow">Customer Portal SaaS</p>
        <h1>Bring customer work into one place.</h1>
        <p class="saas-home__lead">
          Give your team and customers a shared place for timesheets, invoices, and service requests—without stitching together separate tools.
        </p>
        <div class="saas-home__actions">
          <UButton to="/signup" size="xl">Create your portal</UButton>
          <UButton to="/login" color="neutral" variant="outline" size="xl">Sign in</UButton>
        </div>
      </div>

      <figure class="saas-home__visual">
        <img
          :src="'/images/saas-workspaces-hero.png'"
          alt="An abstract control plane connected to three independent customer workspaces and databases"
          width="1536"
          height="1024"
        >
        <figcaption>
          <span>Your organization’s workspace</span>
          <span>Private, focused, and ready for your team</span>
        </figcaption>
      </figure>
    </section>

    <section class="saas-home__model">
      <div class="saas-home__model-intro">
        <h2>Useful from day one. Flexible after that.</h2>
        <p>
          Start with the work that matters now. Your portal stays clear and approachable because it only includes the capabilities your organization uses.
        </p>
      </div>
      <div class="saas-home__model-list">
        <article class="saas-home__model-item">
          <span>01</span>
          <div><h3>Work together clearly</h3><p>Give colleagues and customers one familiar destination for daily work, approvals, requests, and updates.</p></div>
        </article>
        <article class="saas-home__model-item">
          <span>02</span>
          <div><h3>Keep your workspace private</h3><p>Your organization has its own database and authentication boundary instead of sharing customer records with other tenants.</p></div>
        </article>
        <article class="saas-home__model-item">
          <span>03</span>
          <div><h3>Add capability when needed</h3><p>Begin with a focused portal and enable more modules as your team’s processes develop.</p></div>
        </article>
      </div>
    </section>

    <section class="saas-home__modules">
      <div class="saas-home__section-heading">
        <h2>A portal shaped around real customer work.</h2>
        <p class="saas-home__modules-intro">Choose the modules that support your current process. They share one account experience and a consistent way of working.</p>
      </div>
      <div class="saas-home__module-list">
        <article class="saas-home__module"><h3>Timesheets</h3><p>Record hours, review submitted weeks, and keep projects and clients connected to the work.</p></article>
        <article class="saas-home__module"><h3>Invoices</h3><p>Move from approved work to clear invoices using your organization’s own sender details and numbering.</p></article>
        <article class="saas-home__module"><h3>Service requests</h3><p>Give customers a straightforward place to submit requests, follow progress, and stay informed.</p></article>
      </div>
    </section>

    <section class="saas-home__closing">
      <div>
        <h2>Make the portal yours.</h2>
        <p>Create an account to set up your organization and choose the modules you want to start with. Already have an account? Pick up where you left off.</p>
      </div>
      <div class="saas-home__actions mt-0">
        <UButton to="/signup" size="xl">Create account</UButton>
        <UButton to="/login" color="neutral" variant="outline" size="xl">Sign in</UButton>
      </div>
    </section>
  </main>
</template>
