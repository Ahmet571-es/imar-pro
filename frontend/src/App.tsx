import { WizardLayout } from '@/components/layout/WizardLayout'
import { ParcelStep } from '@/components/parcel/ParcelStep'
import { ZoningStep } from '@/components/zoning/ZoningStep'
import { PlanStep } from '@/components/plan/PlanStep'
import { ThreeDStep, FeasibilityStep } from '@/components/wizard/PlaceholderSteps'
import { useProjectStore } from '@/stores/projectStore'

function WizardRouter() {
  const { currentStep } = useProjectStore()

  switch (currentStep) {
    case 'parcel':
      return <ParcelStep />
    case 'zoning':
      return <ZoningStep />
    case 'plan':
      return <PlanStep />
    case '3d':
      return <ThreeDStep />
    case 'feasibility':
      return <FeasibilityStep />
    default:
      return <ParcelStep />
  }
}

export default function App() {
  return (
    <WizardLayout>
      <WizardRouter />
    </WizardLayout>
  )
}
