import Balancer from 'react-wrap-balancer';

export default function BalancedHeading({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1 className={`text-4xl md:text-6xl font-bold text-shadow-lg ${className}`}>
      <Balancer>{children}</Balancer>
    </h1>
  );
}
