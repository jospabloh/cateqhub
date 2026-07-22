import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

export const LOGO_URL =
  "https://media.base44.com/images/public/6a5e79058ec761efd47be7fe/0bc69a0d1_CateHub_ead040f72_logo.png";

export default function Logo({ className }) {
  return (
    <Image
      src={LOGO_URL}
      alt="CateqHub"
      fittingType="fit"
      className={cn("rounded-md bg-white p-0.5", className)}
    />
  );
}