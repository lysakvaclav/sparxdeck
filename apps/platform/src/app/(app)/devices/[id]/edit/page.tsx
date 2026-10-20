import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isManager, requireMembership } from "@/lib/auth";
import { deviceName, deviceTypeFields, readAttributes } from "@/lib/devices";
import { getDevice, getDeviceFormOptions } from "@/lib/records";
import { DeviceForm } from "../../device-form";
import { DeviceFormPage } from "../../form-page";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("devices.form");
  return { title: t("editTitle") };
}

export default async function EditDevicePage({ params }: Props) {
  const { id } = await params;
  const { membership, organization } = await requireMembership();
  if (!isManager(membership.role)) redirect(`/devices/${id}`);
  const device = await getDevice(id);
  if (!device) notFound();
  const t = await getTranslations("devices.form");
  const tCustomers = await getTranslations("customers");
  const { sites, types } = await getDeviceFormOptions(organization.id);
  // The building doesn't change; only its own locations are offered.
  const site = sites.find((option) => option.id === device.site_id);
  if (!site) notFound();
  const attributes = readAttributes(device.attributes, deviceTypeFields(device.type?.custom_fields));
  const customer = device.site?.customer;

  return (
    <DeviceFormPage
      title={t("editTitle")}
      site={null}
      crumbs={[
        { label: tCustomers("title"), href: "/customers" },
        ...(customer ? [{ label: customer.name, href: `/customers/${customer.id}` }] : []),
        { label: site.name, href: `/sites/${site.id}` },
        {
          label: deviceName(device.type?.name ?? "", device.label_number),
          href: `/devices/${device.id}`,
        },
      ]}
    >
      <DeviceForm
        mode="edit"
        deviceId={device.id}
        sites={[site]}
        types={types}
        cancelHref={`/devices/${device.id}`}
        defaults={{
          siteId: site.id,
          locationId: device.location_id ?? "",
          deviceTypeId: device.device_type_id,
          serialNumber: device.serial_number ?? "",
          manufacturer: device.manufacturer ?? "",
          model: device.model ?? "",
          manufactureYear: device.manufacture_year ? String(device.manufacture_year) : "",
          customFields: attributes,
          installedOn: device.installed_on ?? "",
          lastInspectionOn: device.last_inspection_on ?? "",
          endOfLifeOn: device.end_of_life_on ?? "",
          notes: device.notes ?? "",
          status: device.status,
        }}
      />
    </DeviceFormPage>
  );
}
