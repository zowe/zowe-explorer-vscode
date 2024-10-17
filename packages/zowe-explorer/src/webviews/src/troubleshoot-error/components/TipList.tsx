export const TipList = ({ tips }: { tips: string[] }) => {
  return (
    <div>
      <h2>Tips</h2>
      <ul>
        {tips.map((tip) => (
          <li>{tip}</li>
        ))}
      </ul>
    </div>
  );
};
