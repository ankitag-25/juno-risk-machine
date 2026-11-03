export default function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <section className="band band-tall">
      <div className="wrap">
        <h1>Welcome to the Risk Machine</h1>
        <p className="lede">
          At Juno, money that left as crypto was gone for good, so I designed rules that let money in but control
          money out. Describe a user in a few quick answers and see whether those rules would flag them.
        </p>
        <button className="btn-light" onClick={onStart} autoFocus>Create a user</button>
      </div>
    </section>
  );
}
