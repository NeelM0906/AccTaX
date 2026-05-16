import { Building2, CheckCircle2, FileCheck2, UserPlus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@ledgerai/ui";
import { indiaStates } from "@ledgerai/config";
import { saveOnboarding } from "../actions";
import { getOnboardingData } from "@/lib/server/workspace";

export default async function OnboardingPage() {
  const { business, gstRegistrations, taxProfile, members } = await getOnboardingData();
  const gstRegistration = gstRegistrations[0];
  const hasAccountant = members.some((member) => member.role === "ACCOUNTANT" || member.role === "REVIEWER");
  const sections = [
    { title: "Business profile", icon: Building2, done: Boolean(business?.onboardingComplete) },
    { title: "GST registrations", icon: FileCheck2, done: gstRegistrations.length > 0 },
    { title: "Income-tax profile", icon: CheckCircle2, done: Boolean(taxProfile) },
    { title: "Invite accountant", icon: UserPlus, done: hasAccountant }
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Business onboarding</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Maintain the India-specific setup that drives invoices, GST drafts, and tax planning.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Setup progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sections.map((section) => (
              <div key={section.title} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
                <section.icon className={section.done ? "size-4 text-moss" : "size-4 text-zinc-400"} />
                <span className="text-sm font-medium">{section.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>India business setup</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveOnboarding} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Business name
                <Input name="businessName" defaultValue={business?.name ?? ""} required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Legal name
                <Input name="legalName" defaultValue={business?.legalName ?? business?.name ?? ""} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Legal type
                <Select name="legalType" defaultValue={business?.legalType ?? "PROPRIETORSHIP"}>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="PROPRIETORSHIP">Proprietorship</option>
                  <option value="PARTNERSHIP">Partnership</option>
                  <option value="LLP">LLP</option>
                  <option value="COMPANY">Company</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                PAN
                <Input name="pan" defaultValue={business?.pan ?? ""} required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                GSTIN
                <Input name="gstin" defaultValue={gstRegistration?.gstin ?? ""} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Primary state
                <Select name="stateCode" defaultValue={business?.primaryStateCode ?? "27"}>
                  {indiaStates.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Filing frequency
                <Select name="filingFrequency" defaultValue={gstRegistration?.filingFrequency ?? "MONTHLY"}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY_QRMP">Quarterly / QRMP</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Business type
                <Select name="businessType" defaultValue={business?.businessType ?? "PROFESSIONAL"}>
                  <option value="SERVICES">Services</option>
                  <option value="TRADING">Trading</option>
                  <option value="MANUFACTURING">Manufacturing</option>
                  <option value="MIXED">Mixed</option>
                  <option value="EXPORT">Export</option>
                  <option value="PROFESSIONAL">Professional</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Turnover estimate
                <Input name="turnoverEstimate" inputMode="numeric" defaultValue={business?.turnoverEstimate?.toString() ?? "2400000"} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Tax profile
                <Select name="taxProfileKind" defaultValue={taxProfile?.kind ?? "PROFESSIONAL"}>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="BUSINESS">Business</option>
                  <option value="SALARY_PLUS_FREELANCING">Salary + freelancing</option>
                  <option value="EXPORT_SERVICES">Export services</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Presumptive section
                <Select name="presumptiveSection" defaultValue={taxProfile?.presumptiveSection ?? "44ADA"}>
                  <option value="44ADA">44ADA</option>
                  <option value="44AD">44AD</option>
                  <option value="">Not selected</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Cash receipts %
                <Input name="cashReceiptsPercent" inputMode="decimal" defaultValue={taxProfile?.cashReceiptsPercent?.toString() ?? "2"} />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
              <label className="flex items-center gap-2">
                <input name="compositionScheme" type="checkbox" defaultChecked={gstRegistration?.compositionScheme ?? false} />
                Composition scheme
              </label>
              <label className="flex items-center gap-2">
                <input name="optedOutOfNewRegime" type="checkbox" defaultChecked={taxProfile?.optedOutOfNewRegime ?? false} />
                Opted out of default new regime
              </label>
              <Button type="submit">
                <CheckCircle2 className="size-4" />
                Save setup
              </Button>
            </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
