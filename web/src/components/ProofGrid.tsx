import styles from './ProofGrid.module.scss';

interface ProofItem {
  title: string;
  description: string;
  index?: number;
}

interface ProofGridProps {
  items: ProofItem[];
  variant?: 'proof' | 'steps';
}

export function ProofGrid({ items, variant = 'proof' }: ProofGridProps) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article className={variant === 'steps' ? styles.stepCard : styles.card} key={item.title}>
          {variant === 'steps' && item.index ? <span className={styles.index}>{item.index}</span> : null}
          <h3 className={styles.title}>{item.title}</h3>
          <p className={styles.copy}>{item.description}</p>
        </article>
      ))}
    </div>
  );
}
