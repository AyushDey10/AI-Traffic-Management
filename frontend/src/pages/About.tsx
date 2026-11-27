import { Callout, Card, Explain, Icon, Note, PageHeader, StepCard } from "../components/ui";

const STEPS = [
  {
    step: 1,
    title: "Take a traffic video",
    body: "The project uses a recording of a four-road crossing filmed from above. It is a video, not a live camera.",
  },
  {
    step: 2,
    title: "Let the AI look at a picture",
    body: "A video is many pictures shown quickly. The AI looks at one picture at a time, just like you would look at a photo.",
  },
  {
    step: 3,
    title: "Find the vehicles",
    body: "The AI draws a box around each car, motorcycle, bus and truck it finds, and says what type it is.",
  },
  {
    step: 4,
    title: "Work out how busy each road is",
    body: "Each vehicle is given to one of four roads — North, South, East or West. Bigger vehicles count for more because they take more space.",
  },
  {
    step: 5,
    title: "Suggest a smarter green light",
    body: "The road with the most traffic gets the next green light. But a road that has waited too long always gets a turn, so nobody is forgotten.",
  },
];

const WORDS = [
  {
    icon: "spark",
    word: "Artificial Intelligence (AI)",
    meaning: "A computer doing something that normally needs a human brain, like recognising a car in a photo.",
  },
  {
    icon: "cpu",
    word: "Machine Learning",
    meaning: "A way of making AI: instead of writing rules, we show the computer thousands of examples and it learns the pattern.",
  },
  {
    icon: "video",
    word: "Computer Vision",
    meaning: "The part of AI that understands pictures and videos. Face unlock on a phone uses it.",
  },
  {
    icon: "car",
    word: "Detection box",
    meaning: "A rectangle drawn around something the AI found. It is the computer saying “I think a vehicle is here”.",
  },
  {
    icon: "road",
    word: "Congestion",
    meaning: "How crowded a road is. In this project it is estimated from one picture, not measured by sensors in the road.",
  },
  {
    icon: "signals",
    word: "Smart signal",
    meaning: "A traffic light that changes its timing based on the traffic it can see, instead of following a fixed clock.",
  },
  {
    icon: "simulation",
    word: "Simulation",
    meaning: "A computer model of traffic. It lets us test an idea safely, without touching a real road.",
  },
  {
    icon: "clock",
    word: "Waiting time",
    meaning: "How long a vehicle has to wait before it can cross. Lower waiting time means a better signal.",
  },
];

export default function About() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Learn"
        title="How does this project work?"
        description="No technical knowledge needed. Here is the whole idea in five steps, plus simple explanations of the words you will see on the other pages."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[11px] text-warning">
          <Icon name="alert" className="h-3.5 w-3.5" />
          Learning prototype — not for real roads
        </span>
      </PageHeader>

      <Callout icon="bulb" title="The big idea">
        A normal traffic light follows a clock: North 30 seconds, East 30 seconds, and so on, all day.
        This project asks a simple question — <strong>what if the light could see the road?</strong> If
        one road is full and another is empty, the full road should get more green time, while the
        empty road still gets its turn later.
      </Callout>

      <Card title="Five steps" subtitle="Follow the journey of one traffic video.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {STEPS.map((stage) => (
            <StepCard key={stage.step} step={stage.step} title={stage.title}>
              {stage.body}
            </StepCard>
          ))}
        </div>
      </Card>

      <section aria-labelledby="words">
        <h2 id="words" className="mb-3 text-lg font-semibold text-ink">
          Words you will hear
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {WORDS.map((item) => (
            <div key={item.word} className="card card-pad">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan">
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-ink">{item.word}</h3>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.meaning}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Why do traffic jams happen?" subtitle="Simple reasons you see every day.">
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
            {[
              "Too many vehicles want the same road at the same time, especially at school and office hours.",
              "A signal keeps a green light on an empty road while a crowded road waits.",
              "An accident, a broken-down vehicle or road work blocks part of the road.",
              "Rain makes drivers slower and leaves bigger gaps between vehicles.",
              "One road is very busy while the other three are almost empty.",
            ].map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                {reason}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="How a smart signal can help" subtitle="It reacts to what is actually there.">
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
            {[
              "It gives more green time to the road with the most vehicles.",
              "It gives less time to an almost empty road, so nobody waits for nothing.",
              "It never lets a road wait longer than 45 seconds without a turn.",
              "It keeps green time inside safe limits (12 to 45 seconds).",
              "It can explain its choice, so you can check whether it makes sense.",
            ].map((benefit) => (
              <li key={benefit} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {benefit}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="What this project can do" subtitle="Checked behaviour of this build.">
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
            {[
              "Find cars, motorcycles, buses and trucks in a recorded frame.",
              "Decide which of the four roads each vehicle is on, using measured road areas.",
              "Estimate how busy each road is from the vehicles it can see.",
              "Suggest the next green light and explain why.",
              "Compare an old fixed timer with the smart signal in a fair simulation.",
              "Build a report from several moments of the video.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="What it cannot do" subtitle="Stated plainly, so nothing is overclaimed.">
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
            {[
              "It does not use a live camera; the input is a recorded video file.",
              "It does not track vehicles between pictures, so it cannot count different cars.",
              "It does not measure real queues, speed or delay — “how busy” is an estimate from one picture.",
              "It does not control a real traffic light. It only suggests a phase.",
              "It uses a ready-made model that was not trained on this camera angle, so it misses vehicles.",
              "Its simulation results are pretend traffic, not measurements from a real road.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title="How well does the AI see?"
        subtitle="Honest numbers from testing this footage."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-panel/40 p-4">
            <p className="font-mono text-2xl text-ink">~6</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              vehicles found on a frame where a person would count roughly 35–40
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-panel/40 p-4">
            <p className="font-mono text-2xl text-ink">0.10</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              confidence cut-off; a stricter value finds almost nothing from this camera angle
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-panel/40 p-4">
            <p className="font-mono text-2xl text-ink">~200 ms</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              time for the AI to check one 4K picture on a normal laptop processor
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Explain summary="Why does it miss so many vehicles?">
            <p>
              The AI model (YOLOv8n) learned from ordinary photos taken at street level. From above, a
              car looks like a small rectangle, often partly hidden by trees or other vehicles. The model
              still finds some vehicles, but not all. Training a new model on top-down traffic pictures
              is the biggest improvement planned for the future.
            </p>
          </Explain>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Technology used" subtitle="Everything runs on this computer.">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Vehicle detection", "YOLOv8n"],
              ["Video reading", "OpenCV"],
              ["Backend API", "FastAPI"],
              ["Dashboard", "React + TypeScript"],
              ["Styling", "Tailwind CSS"],
              ["Charts", "Recharts"],
              ["Simulation", "Python traffic model"],
              ["Video encoding", "FFmpeg"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="font-mono text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="How the simulation stays fair" subtitle="Same traffic, two signals.">
          <p className="text-[13px] leading-relaxed text-muted">
            The simulation creates pretend vehicles and sends <strong className="text-ink">exactly the
            same vehicles</strong> to both signals. It then measures how long each vehicle waited. The
            only difference is how the green light was chosen.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            The project also repeats the test with ten different traffic patterns, so a single lucky
            result cannot fool you.
          </p>
          <div className="mt-4">
            <Note tone="warn">
              Simulation numbers are <strong>not</strong> measurements from a real city road. They are
              produced by a mathematical model inside this project.
            </Note>
          </div>
        </Card>
      </div>

      <Note tone="warn">
        This dashboard is a school exhibition prototype. Detection, congestion estimates, signal
        suggestions and simulation results are approximations for learning. They must never be used to
        control real traffic.
      </Note>
    </div>
  );
}
