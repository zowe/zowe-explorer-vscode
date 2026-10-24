interface DatasetAttributesDefinition {
    id: string;
    name: string;
    description?: string;
}

const dsnameAttribute: DatasetAttributesDefinition = {
    id: "dsname",
    name: "Data Set Name",
    description: "The name of the dataset",
};

export const DATASET_ATTR_DEFS: DatasetAttributesDefinition[] = [
    dsnameAttribute,
    {
        id: "alloc",
        name: "Allocated Units",
        description: "The number of allocated units",
    },
    {
        id: "allocx",
        name: "Allocated Extents",
        description: "The number of allocated extents",
    },
    {
        id: "blksz",
        name: "Block Size",
        description: "The block size of the dataset",
    },
    {
        id: "catnm",
        name: "Catalog Name",
        description: "The catalog in which the dataset entry is stored",
    },
    {
        id: "cdate",
        name: "Create Date",
        description: "The dataset creation date",
    },
    {
        id: "dataclass",
        name: "Data Class",
        description: "The data class of the dataset",
    },
    {
        id: "dev",
        name: "Device Type",
        description: "The type of the device the dataset is stored on",
    },
    {
        id: "dsntp",
        name: "Data Set Type",
        description: "LIBRARY, (LIBRARY,1), (LIBRARY,2), PDS, HFS, EXTREQ, EXTPREF, BASIC or LARGE",
    },
    {
        id: "dsorg",
        name: "Data Set Organization",
        description: "PS, PO, or DA",
    },
    {
        id: "edate",
        name: "Expiration Date",
        description: "The dataset expiration date",
    },
    {
        id: "encrypted",
        name: "Encrypted",
        description: "Indicates if the dataset is encrypted (YES or NO)",
    },
    {
        id: "extx",
        name: "Extents",
        description: "The number of allocated extents the dataset has",
    },
    {
        id: "lrecl",
        name: "Logical Record Length",
        description: "The length in bytes of each record",
    },
    {
        id: "migr",
        name: "Migrated",
        description: "Indicates if the dataset is migrated (YES or NO)",
    },
    {
        id: "mgmtclass",
        name: "Management Class",
        description: "The management class of the dataset",
    },
    {
        id: "mvol",
        name: "Multivolume",
        description: "Indicates if the dataset is on multiple volumes (YES or NO)",
    },
    {
        id: "ovf",
        name: "Space Overflow",
        description: "Indicates if space overflow was encountered (YES or NO)",
    },
    {
        id: "primary",
        name: "Primary Space",
        description: "The primary space allocation of the dataset",
    },
    {
        id: "rdate",
        name: "Reference Date",
        description: "Last referenced date",
    },
    {
        id: "recfm",
        name: "Record Format",
        description: "Valid values: A, B, D, F, M, S, T, U, V (combinable)",
    },
    {
        id: "secondary",
        name: "Secondary Space",
        description: "The secondary space allocation of the dataset",
    },
    {
        id: "sizex",
        name: "Size",
        description: "Size of the first extent in tracks",
    },
    {
        id: "spacu",
        name: "Space Unit",
        description: "Type of space units measurement",
    },
    {
        id: "storclass",
        name: "Storage Class",
        description: "The storage class of the dataset",
    },
    {
        id: "used",
        name: "Used Space",
        description: "Used space percentage",
    },
    {
        id: "usedx",
        name: "Used Extents",
        description: "The number of used extents",
    },
    {
        id: "vol",
        name: "Volume",
        description: "Volume serial number of the dataset",
    },
    {
        id: "vols",
        name: "Volumes",
        description: "Multiple volume serial numbers",
    },
];

export const MEMBER_ATTR_DEFS: DatasetAttributesDefinition[] = [
    dsnameAttribute,
    {
        id: "member",
        name: "Member Name",
        description: "The name of the member",
    },
    {
        id: "vers",
        name: "Version",
        description: "Member version number",
    },
    {
        id: "mod",
        name: "Modification Level",
        description: "Member modification level",
    },
    {
        id: "c4date",
        name: "Created Date",
        description: "Creation date (4-character year format)",
    },
    {
        id: "m4date",
        name: "Modified Date",
        description: "Last change date (4-character year format)",
    },
    {
        id: "mtime",
        name: "Modified Time",
        description: "Last change time (in format hh:mm)",
    },
    {
        id: "msec",
        name: "Modified Seconds",
        description: "Seconds value of the last change time",
    },
    {
        id: "cnorc",
        name: "Current Records",
        description: "Current number of records",
    },
    {
        id: "inorc",
        name: "Initial Records",
        description: "Initial number of records",
    },
    {
        id: "mnorc",
        name: "Modified Records",
        description: "Number of changed records",
    },
    {
        id: "user",
        name: "User",
        description: "User ID of last user to change the given member",
    },
    {
        id: "sclm",
        name: "Modified by ISPF/SCLM",
        description: "Indicates whether the member was last modified by SCLM or ISPF",
    },
];
