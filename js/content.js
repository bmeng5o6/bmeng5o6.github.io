window.PORTFOLIO = {
  links: {
    resume: "public/resume.pdf",   
    github: "https://github.com/bmeng5o6",
    linkedin: "https://www.linkedin.com/in/bmeng506/",
    email: "bmeng@sas.upenn.edu",
  },

  sections: [
    {
      id: "projects", label: "Projects",
      size: 1.12, hue: 22, seed: 7, type: "projects",
      featured: [
        {
          title: "Distributed Job Scheduler",
          desc: "A job scheduler where many worker processes pull work from a shared Postgres queue. Implemented heartbeats to detect dead workers, epochs to reject writes from stalled workers, and exponential backoff to retry jobs if they fail.",
          stack: ["Go", "PostgreSQL", "Docker"],
          code: "https://github.com/bmeng5o6/distributed-job-scheduler",
        },
        {
          title: "Distributed Key-Value Store",
          desc: "A key-value store that distributes keys across nodes on a hash ring with consistent hashing. Each shard has a leader that replicates to followers, a write-ahead log keeps data even with crashes, and a gossip-based failure detection that directs requests to replicas when leaders are unresponsive.",
          stack: ["Go", "AWS EC2", "Docker"],
          code: "https://github.com/bmeng5o6/distributed-kv-store",
        },
        {
          title: "Career@Penn",
          desc: "A web app for Penn students to explore internship and post-grad career data by school and major: employer and pay data, post-grad outcomes from 2017–2024, and thousands of past internship placements. Built with a six-person Penn Spark team that I helped lead.",
          stack: ["Next.js", "TypeScript", "Supabase"],
          code: "https://github.com/bmeng5o6/career-at-penn",
        },
      ],
      other: [
        // { title: "CalendarSync", desc: "Combines friends' calendars to find free time that works for everyone", stack: "FastAPI, React", code: "https://github.com/bmeng5o6/calendar-sync" },
        { title: "Upstage Website", desc: "Website, show, ticketing, and audition management for Upstage A Cappella", stack: "Next.js, Supabase", code: "https://github.com/bmeng5o6/upstage-website" },
      ],
    },
    {
      id: "experience", label: "Experience",
      size: 1.0, hue: 250, seed: 21, type: "experience",
      items: [
        {
          role: "Software Engineer Intern",
          org: "Lunar Energy",
          dates: "May - Aug 2026",
          bullets: [
            "Enabled real-time consumption forecasts for previously skipped cold-start EV charging sessions by building a Python charging-duration fallback in Gridshare's AWS Lambda pipeline.",
            "Increased detected EV charging events by ~50% in production by reprocessing detection windows to catch multiple charging events per window, recovering events the pipeline previously missed.",
            "Improved battery-state estimates by adding an MAE threshold rejecting poor curve fits, cutting error variance by 25% and enabling more accurate charge/discharge and grid decisions in cost optimization.",
          ],
        },
        {
          role: "ML Engineer Intern",
          org: "Lilia AI",
          dates: "May - Aug 2025",
          bullets: [
            "Built an end-to-end Python pipeline automating DICOM ingestion and preprocessing across 200+ CT scans, producing model-ready inputs for a PyTorch-based medical model training.",
            "Developed and integrated a reusable Python sizing agent into a multi-agent medical-imaging system, automating millimeter-scale volume, surface area, and diameter measurements with ~3% mean relative error."
          ],
        },
        {
          role: "AI Engineer Intern",
          org: "Epikast",
          dates: "June - Aug 2025",
          bullets: [
            "Fine-tuned Mistral-7B via Direct Preference Optimization (DPO) and optimized training with quantization to enable training on single Tesla T4 GPU.",
            "Designed synthetic data pipeline, converted medical transcripts into DPO pairs, developed automated evaluation framework using DeepEval metrics for medical accuracy, deployed endpoints with AWS SageMaker."
          ],
        },
        {
          role: "Software Engineer Intern",
          org: "Crypt0nest",
          dates: "June - Aug 2025",
          bullets: [
            "Built multi-factor NASDAQ-100 model with walk-forward XGBoost regression, validated across 5-year backtest.",
            "Engineered high-dimensional feature library in Python, implemented Fama-French 5-factor data, rolling volatility z-scores, and sentiment indicators to model non-linear market regime shifts, improved signal quality by implementing SHAP-based feature importance to prune noisy features."
          ],
        },
        {
          role: "Software Engineer Intern",
          org: "Forkast",
          dates: "March - May 2025",
          bullets: [
            "Built a cross-platform React Native mobile prototype of the existing restaurant dynamic-pricing app, porting onboarding, account creation, KPI dashboards, and category-level pricing controls, establishing foundation for mobile development, led software intern team of 6 on project development."
          ],
        },
      ],
    },
    {
      id: "about", label: "About", blurb: "Who I am",
      size: 0.95, hue: 34, seed: 5, type: "about",
      paragraphs: [
        "Hi, I'm Brian Meng! I'm a third-year at the University of Pennsylvania studying Computer Science and Mathematical Economics, and I'm interested in software engineering, mathematics, and statistics.",
        "I'm really interested in backend/full-stack development, machine learning, and low-level design. With projects from fintech to energy, I enjoy working on features or building out ideas from 0 to 1.",
        "Outside of work, I'm passionate about performing arts and music. I'm involved in theatre and a cappella at Penn.",
      ],
      education: {
        school: "University of Pennsylvania",
        degree: "B.S.E. Computer Science, Second Major in Mathematical Economics",
        when: "Expected May 2028",
      },
      skills: [
        { group: "Languages", items: ["Python", "Java", "Go", "TypeScript/JavaScript", "C/C++", "SQL", "R", "OCaml"] },
        { group: "Frameworks & Libraries", items: ["Next.js", "React", "React Native", "Django", "FastAPI", "Flask", "SQLAlchemy"] },
        { group: "Cloud & DevOps", items: ["AWS (Lambda, EC2, S3, Redshift, CloudWatch)", "Docker", "Linux/Unix"] },
        { group: "Databases & Search", items: ["PostgreSQL", "SQLite", "Elasticsearch"]}
      ],
    },
    {
      id: "arts", label: "Arts",
      size: 1.0, hue: 318, seed: 13, type: "arts",
      paragraphs: [
        "I've been involved in the arts for as long as I can remember, playing trumpet and piano or painting in acrylic or watercolor. I also love picking up new instruments. I'm currently learning guitar!",
      ],
      groups: [
        { title: "Groups on Campus", items: ["The Mask and Wig Club - Assistant Stage Manager", "Upstage A Cappella"] },
        { title: "Instruments and Music", items: ["Piano", "Trumpet", "Guitar"] },
      ],
      // Optional photos / media. Add files to an img/ folder, e.g.
      // { src: "img/mask-and-wig.jpg", caption: "Mask and Wig, Spring 2026" }
      gallery: [],
    },
    {
      id: "contact", label: "Contact",
      size: 0.88, hue: 205, seed: 44, type: "contact",
      lede: "Feel free to reach out!",
    },
  ],
};
