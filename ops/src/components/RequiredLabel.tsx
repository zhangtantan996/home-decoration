type RequiredLabelProps = {
  children: string;
};

const RequiredLabel = ({ children }: RequiredLabelProps) => (
  <span className="ops-required-label">
    <span>{children}</span>
    <span aria-hidden="true" className="ops-required-label__mark">*</span>
  </span>
);

export default RequiredLabel;
