// NetApp Enterprise Configurator & Code Generator Engine (v1.4.0)
// Built using vanilla ES6 JS, CDN JSZip, PrismJS and Lucide Icons

// 1. CONSTANTS & VERSION OPTIONS
const ONTAP_VERSIONS = ["9.19.1", "9.18.1", "9.17.1", "9.16.1", "9.15.1", "9.14.1", "9.13.1", "9.12.1", "9.11.1", "9.10.1", "9.9.1", "9.8.0", "9.7.0"];
const STORAGEGRID_VERSIONS = ["12.0", "11.9", "11.8", "11.7", "11.6", "11.5"];
const CISCO_VERSIONS = ["9.3.9", "9.2.2", "8.4.2"];
const BROCADE_VERSIONS = ["9.2.0", "9.1.0", "9.0.1", "8.2.3"];

// Implement versionToNum as specified in prompt
function versionToNum(vStr) {
  if (!vStr) return 0;
  const parts = vStr.split('.').map(Number);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  return major * 100 + minor;
}

// Safety wrappers for external CDN assets
function safeCreateIcons() {
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (e) {
    console.warn("Lucide icons rendering failed:", e);
  }
}

function safeHighlightElement(el) {
  try {
    if (typeof Prism !== 'undefined' && Prism.highlightElement) {
      Prism.highlightElement(el);
    }
  } catch (e) {
    console.warn("Prism code highlighter failed:", e);
  }
}

function safeNewJSZip() {
  try {
    if (typeof JSZip !== 'undefined') {
      return new JSZip();
    }
  } catch (e) {
    console.warn("JSZip failed to instantiate:", e);
  }
  return null;
}

function safeTriggerDownload(filename, data) {
  console.log("safeTriggerDownload triggered for:", filename);
  try {
    const isBlob = (data instanceof Blob) || (data && typeof data === 'object' && typeof data.size === 'number' && typeof data.type === 'string');
    
    let hasNativeHandler = false;
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.downloadHandler) {
        hasNativeHandler = true;
      }
    } catch (e) {
      console.warn("Native bridge check encountered an error:", e);
    }

    if (hasNativeHandler) {
      console.log("Using native macOS download bridge for:", filename);
      const blob = isBlob ? data : new Blob([data], { type: "text/plain;charset=utf-8" });
      const reader = new FileReader();
      reader.onloadend = function() {
        try {
          const result = reader.result;
          if (result && result.indexOf(',') !== -1) {
            const base64Data = result.split(',')[1];
            window.webkit.messageHandlers.downloadHandler.postMessage({
              filename: filename,
              base64Data: base64Data
            });
          } else {
            console.error("FileReader result format invalid for base64 extraction");
          }
        } catch (err) {
          console.error("Error sending message to native bridge:", err);
        }
      };
      reader.readAsDataURL(blob);
    } else {
      // Browser download
      if (!isBlob) {
        // For text data, use synchronous data URI to avoid async gesture detection issues
        console.log("Using standard browser data URL download for text:", filename);
        const link = document.createElement("a");
        link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(data);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For Blob (e.g. JSZip), convert to Data URL using FileReader to bypass Chrome file:/// blob block
        console.log("Converting Blob to Data URL for browser download:", filename);
        const reader = new FileReader();
        reader.onloadend = function() {
          try {
            const dataUrl = reader.result;
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (err) {
            console.error("Error triggering browser download from data URL:", err);
          }
        };
        reader.readAsDataURL(data);
      }
    }
  } catch (globalErr) {
    console.error("Error in safeTriggerDownload:", globalErr);
    alert("An error occurred while attempting to download " + filename + ". See console for details.");
  }
}

// 2. CONFIGURATOR STATE
const state = {
  currentStep: 1,
  scenario: "generic",
  
  // Platform & Mode settings
  mode: "greenfield", // "greenfield" or "existing"
  platform: "ontap",  // "ontap" or "storagegrid"
  ontapPlatform: "aff", // "aff", "asa", "afx"
  version: "9.19.1",  // default

  ui: {
    previewPinned: false
  },

  protocols: ["nfs"],

  metrocluster: {
    enabled: false,
    type: "ip",
    scale: "4",
    distance: 10,
    latency: 1.5,
    mediator: "mediator"
  },
  
  // Dynamic Resources Arrays
  svms: [
    { id: 1, name: "svm_data", dataIp: "192.168.20.21" }
  ],
  volumes: [
    { id: 1, name: "vol_data", svmName: "svm_data", aggregate: "aggr1", size: 100, sizeUnit: "GB", iops: 1000, encryption: false, fabricpool: "none", luns: [] }
  ],
  
  // StorageGRID Tenants & Buckets arrays
  sgTenants: [
    { id: 1, name: "Production-Tenant", quota: 500, sites: 1, ilmPolicy: "2_copies", protocol: "s3", allowPlatformServices: true }
  ],
  sgBuckets: [
    { id: 1, name: "company-s3-bucket", tenantName: "Production-Tenant", region: "us-east-1", versioning: true, objectLock: false, retentionDays: 30, eventNotifications: false, cloudMirror: false, searchIntegration: false, bucketBranches: false }
  ],

  // Host & Workload Integrations
  workload: {
    hypervisor: "none", // none, esxi, hyperv, kvm
    db: "none", // none, oracle, mssql, postgres
    esxi: {
      nfsVersion: "3",
      multipathPolicy: "VMW_PSP_RR",
      vaaiEnabled: true,
      hosts: "192.168.30.11, 192.168.30.12"
    },
    hyperv: {
      mpioEnabled: true,
      csvEnabled: true,
      iscsiTimeout: 60,
      hosts: "hyperv-node1, hyperv-node2"
    },
    kvm: {
      multipathEnabled: true,
      hosts: "kvm-node1, kvm-node2"
    },
    oracle: {
      asmDiskGroups: "DATA, RECO, ARCH",
      sectorSize: "4096",
      gridUser: "grid",
      oracleUser: "oracle"
    },
    mssql: {
      allocationUnitSize: "64KB",
      collation: "SQL_Latin1_General_CP1_CI_AS",
      alwaysOnEnabled: true
    },
    postgres: {
      walSegmentSize: "16MB",
      sharedBuffers: "4GB"
    }
  },

  // ONTAP FabricPool Target settings
  ontapFabricPool: {
    enabled: false,
    endpoint: "s3.storagegrid.company.com",
    port: 10443,
    accessKey: "SG_FP_ACCESS_KEY_XYZ",
    secretKey: "SG_FP_SecretKey_12345abcdef",
    bucket: "ontap-fabricpool-tier",
    sslEnabled: true,
    providerType: "SG",
    caCertName: "FabricPool_CA",
    caCertPem: ""
  },

  // StorageGRID grid integrations
  sgIntegrations: {
    identityFederation: "none",
    kmsProvider: "none",
    ilmPolicy: "2_copies",
    eventNotifications: false,
    cloudMirror: false,
    searchIntegration: false,
    tlsCompliance: "tls_1_3",
    s3Caching: false,
    assumeRole: false,
    // HA and LB extensions
    haGroupName: "ha-gateway-group",
    haVip: "192.168.10.50",
    haMembers: "sg-gateway-01, sg-gateway-02",
    lbEndpointName: "s3-load-balancer",
    lbPort: 10443,
    lbProtocol: "https"
  },

  // Parsed status trackers (true if extracted from ASUP)
  parsedFields: {
    mgmtIp: false,
    svmName: false,
    aggrName: false,
    volName: false,
    initiators: false
  },

  // Storage Settings (fallback / simple parameters for StorageGRID)
  storage: {
    svm: "svm_data",
    aggregate: "aggr1",
    volume: "vol_data",
    size: 100,
    sizeUnit: "GB",
    efficiencyDedupe: true,
    efficiencyCompression: true,
    snapshot: "default",
    // StorageGRID specific (kept for fallback compatibility)
    sgBucketName: "company-s3-bucket",
    sgRegion: "us-east-1",
    sgVersioning: true,
    sgObjectLock: false,
    sgRetentionDays: 30
  },

  // Protocol settings
  protocol: "nfs", // default
  protocolData: {
    nfs: {
      exportPolicy: "default",
      clientMatch: "0.0.0.0/0",
      accessLevel: "rw"
    },
    smb: {
      shareName: "smb_share",
      adDomain: "corp.company.com",
      workgroup: "WORKGROUP",
      permissions: "full_control"
    },
    iscsi: {
      targetIqn: "iqn.1992-08.com.netapp:node",
      initiatorIqn: "iqn.1998-01.com.vmware:esxi-host",
      chapEnable: false,
      chapUser: "chap_admin",
      chapPassword: "NetAppCHAPSecret123"
    },
    fc: {
      targetWwpn: "20:01:00:a0:98:34:cf:11, 20:02:00:a0:98:34:cf:12",
      initiatorWwpn: "21:00:00:24:ff:89:12:0a, 21:00:00:24:ff:89:12:0b",
      igroupName: "ig_fc_hosts"
    },
    fcoe: {
      targetWwpn: "20:11:00:a0:98:34:cf:11, 20:12:00:a0:98:34:cf:12",
      initiatorWwpn: "21:11:00:24:ff:89:12:0a, 21:12:00:24:ff:89:12:0b",
      igroupName: "ig_fcoe_hosts",
      vlanId: 100
    },
    nvme_tcp: {
      targetNqn: "nqn.1992-08.com.netapp:subsystem.prod1",
      hostNqn: "nqn.2014-08.org.nvmexpress:uuid:e00305b0-e34d-11ed-b5ea-005056b3e210",
      port: 4420,
      subsystem: "subsys_nvme"
    },
    nvme_fc: {
      targetNqn: "nqn.1992-08.com.netapp:subsystem.fc1",
      hostNqn: "nqn.2014-08.org.nvmexpress:uuid:fc-uuid-99a8",
      subsystem: "subsys_nvme_fc"
    },
    ontap_s3: {
      bucket: "ontap-s3-bucket",
      accessKey: "NETAPP_S3_KEY1",
      secretKey: "NetAppSecretKey456",
      ssl: true
    }
  },

  // Switch configuration
  network: {
    switchBrand: "cisco", // cisco, brocade, generic
    switchVersion: "9.3.9",
    portSpeed: "25",
    mtu: "1500",
    vlanId: 20,
    mgmtIp: "192.168.10.50",
    zoningEnable: true
  },

  // Hostname Customizations
  customNodeNames: [],
  customSwitchNames: { switchA: "Switch-A", switchB: "Switch-B" },

  // Kubernetes Trident driver
  trident: {
    enabled: false,
    k8sVersion: "1.29",
    driverVersion: "24.02",
    reclaimPolicy: "Delete",
    fsType: "ext4",
    backendName: "trident-backend-san"
  },

  // Dynamic Sizing & Capacity Calculator
  sizing: {
    controller: "A150",
    nodeCount: 2,
    shelfType: "NS224",
    diskCount: 24,
    diskSize: "3.8TB",
    raidType: "raid_dp",
    raidGroupSize: 24,
    spareDisks: 2,
    aggrNamePrefix: "aggr_data",
    clusterCabling: "switched",
    clusterSwitchModel: "Nexus3132QV"
  },

  // Quality of Service Throttling
  qos: {
    policyType: "none",
    expectedIops: 0,
    peakIops: 10000,
    peakThroughput: 500,
    allocatedIops: 250,
    peakIopsPerTb: 1000,
    absoluteMinIops: 75
  }
};

// 2.1 SCENARIO PRESETS & HELPERS
const SCENARIO_PRESETS = {
  generic: {
    platform: "ontap",
    ontapPlatform: "aff",
    protocol: "nfs",
    svms: [
      { id: 1, name: "svm_data", dataIp: "192.168.20.21" }
    ],
    volumes: [
      { id: 1, name: "vol_data", svmName: "svm_data", aggregate: "aggr1", size: 100, sizeUnit: "GB", iops: 1000, encryption: false, fabricpool: false, luns: [] }
    ],
    workload: {
      hypervisor: "none",
      db: "none"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "25",
      mtu: "1500",
      vlanId: 20,
      zoningEnable: false
    }
  },
  esxi_nfs: {
    platform: "ontap",
    ontapPlatform: "aff",
    protocol: "nfs",
    svms: [
      { id: 1, name: "svm_esxi_nfs", dataIp: "192.168.30.21" }
    ],
    volumes: [
      { id: 1, name: "vol_esxi_ds1", svmName: "svm_esxi_nfs", aggregate: "aggr_ssd_1", size: 2, sizeUnit: "TB", iops: 8000, encryption: true, fabricpool: false, luns: [] },
      { id: 2, name: "vol_esxi_ds2", svmName: "svm_esxi_nfs", aggregate: "aggr_ssd_2", size: 2, sizeUnit: "TB", iops: 8000, encryption: true, fabricpool: false, luns: [] }
    ],
    workload: {
      hypervisor: "esxi",
      db: "none"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "25",
      mtu: "9000",
      vlanId: 30,
      zoningEnable: false
    }
  },
  esxi_iscsi: {
    platform: "ontap",
    ontapPlatform: "asa",
    protocol: "iscsi",
    svms: [
      { id: 1, name: "svm_esxi_san", dataIp: "192.168.40.21" }
    ],
    volumes: [
      {
        id: 1,
        name: "vol_esxi_vmfs1",
        svmName: "svm_esxi_san",
        aggregate: "aggr_nvme_1",
        size: 5,
        sizeUnit: "TB",
        iops: 15000,
        encryption: true,
        fabricpool: false,
        luns: [
          { id: 1, name: "lun_esxi_ds1", size: 5, sizeUnit: "TB", osType: "vmware" }
        ]
      }
    ],
    workload: {
      hypervisor: "esxi",
      db: "none"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "25",
      mtu: "9000",
      vlanId: 40,
      zoningEnable: true
    }
  },
  mssql_iscsi: {
    platform: "ontap",
    ontapPlatform: "asa",
    protocol: "iscsi",
    svms: [
      { id: 1, name: "svm_sql_san", dataIp: "192.168.50.21" }
    ],
    volumes: [
      {
        id: 1,
        name: "vol_sql_data",
        svmName: "svm_sql_san",
        aggregate: "aggr_nvme_1",
        size: 800,
        sizeUnit: "GB",
        iops: 25000,
        encryption: true,
        fabricpool: false,
        luns: [
          { id: 1, name: "lun_sql_mdf1", size: 400, sizeUnit: "GB", osType: "windows" },
          { id: 2, name: "lun_sql_mdf2", size: 400, sizeUnit: "GB", osType: "windows" }
        ]
      },
      {
        id: 2,
        name: "vol_sql_log",
        svmName: "svm_sql_san",
        aggregate: "aggr_nvme_1",
        size: 200,
        sizeUnit: "GB",
        iops: 12000,
        encryption: true,
        fabricpool: false,
        luns: [
          { id: 1, name: "lun_sql_ldf1", size: 200, sizeUnit: "GB", osType: "windows" }
        ]
      },
      {
        id: 3,
        name: "vol_sql_temp",
        svmName: "svm_sql_san",
        aggregate: "aggr_nvme_1",
        size: 150,
        sizeUnit: "GB",
        iops: 18000,
        encryption: true,
        fabricpool: false,
        luns: [
          { id: 1, name: "lun_sql_tempdb", size: 150, sizeUnit: "GB", osType: "windows" }
        ]
      }
    ],
    workload: {
      hypervisor: "hyperv",
      db: "mssql"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "25",
      mtu: "9000",
      vlanId: 50,
      zoningEnable: true
    }
  },
  oracle_fc: {
    platform: "ontap",
    ontapPlatform: "asa",
    protocol: "fc",
    svms: [
      { id: 1, name: "svm_oracle_fc", dataIp: "192.168.60.21" }
    ],
    volumes: [
      {
        id: 1,
        name: "vol_oracle_data",
        svmName: "svm_oracle_fc",
        aggregate: "aggr_nvme_1",
        size: 1,
        sizeUnit: "TB",
        iops: 30000,
        encryption: true,
        fabricpool: false,
        luns: [
          { id: 1, name: "lun_asm_data1", size: 500, sizeUnit: "GB", osType: "linux" },
          { id: 2, name: "lun_asm_data2", size: 500, sizeUnit: "GB", osType: "linux" }
        ]
      },
      {
        id: 2,
        name: "vol_oracle_redo",
        svmName: "svm_oracle_fc",
        aggregate: "aggr_nvme_1",
        size: 200,
        sizeUnit: "GB",
        iops: 20000,
        encryption: true,
        fabricpool: false,
        luns: [
          { id: 1, name: "lun_asm_redo1", size: 100, sizeUnit: "GB", osType: "linux" },
          { id: 2, name: "lun_asm_redo2", size: 100, sizeUnit: "GB", osType: "linux" }
        ]
      },
      {
        id: 3,
        name: "vol_oracle_arch",
        svmName: "svm_oracle_fc",
        aggregate: "aggr_ssd_2",
        size: 300,
        sizeUnit: "GB",
        iops: 2000,
        encryption: false,
        fabricpool: true,
        luns: [
          { id: 1, name: "lun_asm_arch1", size: 300, sizeUnit: "GB", osType: "linux" }
        ]
      }
    ],
    workload: {
      hypervisor: "none",
      db: "oracle"
    },
    network: {
      switchBrand: "brocade",
      portSpeed: "32_fc",
      mtu: "1500",
      vlanId: 10,
      zoningEnable: true
    }
  },
  trident_k8s: {
    platform: "ontap",
    ontapPlatform: "aff",
    protocol: "nfs",
    svms: [
      { id: 1, name: "svm_trident", dataIp: "192.168.70.21" }
    ],
    volumes: [
      { id: 1, name: "vol_trident_pvc1", svmName: "svm_trident", aggregate: "aggr_ssd_1", size: 500, sizeUnit: "GB", iops: 3000, encryption: false, fabricpool: false, luns: [] }
    ],
    workload: {
      hypervisor: "none",
      db: "none"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "25",
      mtu: "1500",
      vlanId: 70,
      zoningEnable: false
    }
  },
  mixed_enterprise: {
    platform: "ontap",
    ontapPlatform: "aff",
    protocol: "nfs",
    svms: [
      { id: 1, name: "svm_nas_prod", dataIp: "192.168.80.21" },
      { id: 2, name: "svm_san_prod", dataIp: "192.168.90.21" }
    ],
    volumes: [
      { id: 1, name: "vol_nfs_share1", svmName: "svm_nas_prod", aggregate: "aggr_ssd_1", size: 2, sizeUnit: "TB", iops: 4000, encryption: true, fabricpool: "none", luns: [] },
      { id: 2, name: "vol_smb_share1", svmName: "svm_nas_prod", aggregate: "aggr_ssd_2", size: 3, sizeUnit: "TB", iops: 2000, encryption: true, fabricpool: "auto", luns: [] },
      {
        id: 3,
        name: "vol_san_vols1",
        svmName: "svm_san_prod",
        aggregate: "aggr_nvme_1",
        size: 1,
        sizeUnit: "TB",
        iops: 12000,
        encryption: true,
        fabricpool: "none",
        luns: [
          { id: 1, name: "lun_prod_db1", size: 500, sizeUnit: "GB", osType: "linux" },
          { id: 2, name: "lun_prod_db2", size: 500, sizeUnit: "GB", osType: "linux" }
        ]
      }
    ],
    workload: {
      hypervisor: "esxi",
      db: "oracle"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "25",
      mtu: "9000",
      vlanId: 80,
      zoningEnable: true
    }
  },
  sg_generic: {
    platform: "storagegrid",
    protocol: "storagegrid_s3",
    sgTenants: [
      { id: 1, name: "Corp-Tenant", quota: 1000, sites: 1, ilmPolicy: "2_copies", protocol: "s3", allowPlatformServices: true }
    ],
    sgBuckets: [
      { id: 1, name: "corp-assets", tenantName: "Corp-Tenant", region: "us-east-1", versioning: true, objectLock: false, retentionDays: 30, eventNotifications: false, cloudMirror: false, searchIntegration: false }
    ],
    sgIntegrations: {
      identityFederation: "none",
      kmsProvider: "none",
      ilmPolicy: "2_copies",
      eventNotifications: false,
      cloudMirror: false,
      searchIntegration: false,
      tlsCompliance: "tls_1_3",
      haGroupName: "ha-gateway-group",
      haVip: "192.168.10.50",
      haMembers: "sg-gateway-01, sg-gateway-02",
      lbEndpointName: "s3-load-balancer",
      lbPort: 10443,
      lbProtocol: "https"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "25",
      mtu: "9000",
      vlanId: 100,
      zoningEnable: false
    }
  },
  sg_compliance: {
    platform: "storagegrid",
    protocol: "storagegrid_s3",
    sgTenants: [
      { id: 1, name: "Compliance-Tenant", quota: 5000, sites: 1, ilmPolicy: "3_copies", protocol: "s3", allowPlatformServices: false }
    ],
    sgBuckets: [
      { id: 1, name: "legal-archives", tenantName: "Compliance-Tenant", region: "us-east-2", versioning: true, objectLock: true, retentionDays: 365, eventNotifications: false, cloudMirror: false, searchIntegration: false },
      { id: 2, name: "medical-records", tenantName: "Compliance-Tenant", region: "us-east-2", versioning: true, objectLock: true, retentionDays: 2555, eventNotifications: false, cloudMirror: false, searchIntegration: false }
    ],
    sgIntegrations: {
      identityFederation: "active_directory",
      kmsProvider: "hashicorp",
      ilmPolicy: "3_copies",
      eventNotifications: false,
      cloudMirror: false,
      searchIntegration: false,
      tlsCompliance: "tls_1_3",
      haGroupName: "ha-compliance-group",
      haVip: "192.168.12.50",
      haMembers: "sg-gateway-01, sg-gateway-02",
      lbEndpointName: "s3-compliance-lb",
      lbPort: 10443,
      lbProtocol: "https"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "100",
      mtu: "9000",
      vlanId: 200,
      zoningEnable: false
    }
  },
  sg_hybrid_cloud: {
    platform: "storagegrid",
    protocol: "storagegrid_s3",
    sgTenants: [
      { id: 1, name: "App-Dev-Tenant", quota: 2000, sites: 1, ilmPolicy: "2_copies", protocol: "s3", allowPlatformServices: true },
      { id: 2, name: "Analytics-Tenant", quota: 1000, sites: 1, ilmPolicy: "2_copies", protocol: "s3", allowPlatformServices: true }
    ],
    sgBuckets: [
      { id: 1, name: "app-images", tenantName: "App-Dev-Tenant", region: "us-west-1", versioning: true, objectLock: false, retentionDays: 30, eventNotifications: true, cloudMirror: true, searchIntegration: false },
      { id: 2, name: "analytics-datalake", tenantName: "Analytics-Tenant", region: "us-west-1", versioning: false, objectLock: false, retentionDays: 30, eventNotifications: false, cloudMirror: false, searchIntegration: true }
    ],
    sgIntegrations: {
      identityFederation: "openldap",
      kmsProvider: "ciphertrust",
      ilmPolicy: "ec_4_2",
      eventNotifications: true,
      cloudMirror: true,
      searchIntegration: true,
      tlsCompliance: "tls_1_2",
      haGroupName: "ha-hybrid-group",
      haVip: "192.168.14.50",
      haMembers: "sg-gateway-01, sg-gateway-02",
      lbEndpointName: "s3-hybrid-lb",
      lbPort: 10443,
      lbProtocol: "https"
    },
    network: {
      switchBrand: "cisco",
      portSpeed: "100",
      mtu: "9000",
      vlanId: 300,
      zoningEnable: false
    }
  }
};

function isSanProtocol(proto) {
  return ["iscsi", "fc", "fcoe", "nvme_tcp", "nvme_fc"].includes(proto);
}

function addLunToVolume(volId) {
  const vol = state.volumes.find(v => v.id === volId);
  if (!vol) return;
  if (!vol.luns) vol.luns = [];
  const nextId = vol.luns.length + 1;
  vol.luns.push({
    id: nextId,
    name: `lun_${vol.name}_${nextId}`,
    size: Math.round(vol.size / 2),
    sizeUnit: vol.sizeUnit,
    osType: state.workload.hypervisor === "hyperv" ? "windows" : (state.workload.hypervisor === "esxi" ? "vmware" : "linux")
  });
  renderVolumeTable();
  updateCodePreview();
  validateForm();
}

function applyScenarioTemplate(scenarioKey) {
  const preset = SCENARIO_PRESETS[scenarioKey];
  if (!preset) return;

  state.scenario = scenarioKey;
  state.platform = preset.platform;
  state.ontapPlatform = preset.ontapPlatform || "aff";
  state.protocol = preset.protocol;
  state.svms = preset.svms ? JSON.parse(JSON.stringify(preset.svms)) : [];
  state.volumes = preset.volumes ? JSON.parse(JSON.stringify(preset.volumes)) : [];
  state.workload.hypervisor = preset.workload ? (preset.workload.hypervisor || "none") : "none";
  state.workload.db = preset.workload ? (preset.workload.db || "none") : "none";
  state.network.switchBrand = preset.network ? (preset.network.switchBrand || "cisco") : "cisco";
  state.network.portSpeed = preset.network ? (preset.network.portSpeed || "25") : "25";
  state.network.mtu = preset.network ? (preset.network.mtu || "1500") : "1500";
  state.network.vlanId = preset.network ? (preset.network.vlanId || 20) : 20;
  state.network.zoningEnable = preset.network ? (preset.network.zoningEnable || false) : false;

  state.trident.enabled = (scenarioKey === "trident_k8s");

  if (preset.platform === "storagegrid") {
    state.sgTenants = JSON.parse(JSON.stringify(preset.sgTenants || []));
    state.sgBuckets = JSON.parse(JSON.stringify(preset.sgBuckets || []));
    if (preset.sgIntegrations) {
      state.sgIntegrations = JSON.parse(JSON.stringify(preset.sgIntegrations));
      if (state.sgIntegrations.s3Caching === undefined) state.sgIntegrations.s3Caching = false;
      if (state.sgIntegrations.assumeRole === undefined) state.sgIntegrations.assumeRole = false;
    }
  }

  updateVersionOptions();
  
  const scenarioSelect = document.getElementById("deploymentScenario");
  if (scenarioSelect) scenarioSelect.value = scenarioKey;

  syncUIWithState();
  updateCodePreview();
  validateForm();
}

// 3. INITIALIZATION & UI SYNCING
document.addEventListener("DOMContentLoaded", () => {
  console.log("Configurator Init - Save button in DOM:", !!document.getElementById("btnSaveConfig"));
  console.log("Configurator Init - Load button in DOM:", !!document.getElementById("btnLoadConfig"));

  // Load state from local storage if available
  try {
    const savedStateStr = localStorage.getItem("netapp_configurator_state");
    if (savedStateStr) {
      const parsed = JSON.parse(savedStateStr);
      if (parsed && (parsed.platform === "ontap" || parsed.platform === "storagegrid")) {
        Object.assign(state, parsed);
        state.mode = "greenfield";
      }
    }
  } catch (e) {
    console.warn("Failed to load saved state from localStorage:", e);
  }

  // Initialize Lucide Icons
  safeCreateIcons();
  
  // Populate Versions lists
  updateVersionOptions();
  updateSwitchVersionOptions();
  
  // Set up event listeners
  setupEventListeners();
  
  // Perform initial render
  const loadedVersion = state.version;
  let loadedStep = parseInt(state.currentStep) || 1;

  syncUIWithState();

  // Trigger platform UI sync without losing the loaded version
  if (state.platform === "storagegrid") {
    setPlatform("storagegrid");
    if (loadedStep === 5 || loadedStep === 6 || loadedStep === 7) {
      loadedStep = 4;
    }
  } else {
    setPlatform("ontap");
  }

  if (loadedVersion) {
    state.version = loadedVersion;
    const versionSelect = document.getElementById("platformVersion");
    if (versionSelect) {
      versionSelect.value = state.version;
    }
  }

  showStep(loadedStep);
  validateForm();
});

// Populate version selector dropdown based on platform
function updateVersionOptions() {
  const versionSelect = document.getElementById("platformVersion");
  if (!versionSelect) return;
  versionSelect.innerHTML = "";
  
  const versions = state.platform === "ontap" ? ONTAP_VERSIONS : STORAGEGRID_VERSIONS;
  if (state.version) {
    const isOntapVersion = state.version.startsWith("9.");
    const isSgVersion = state.version.startsWith("11.") || state.version.startsWith("12.");
    if (state.platform === "ontap" && isSgVersion) {
      state.version = versions[0];
    } else if (state.platform === "storagegrid" && isOntapVersion) {
      state.version = versions[0];
    }
  }
  const listToUse = [...versions];
  if (state.version && !listToUse.includes(state.version)) {
    listToUse.unshift(state.version);
  }
  
  listToUse.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.innerText = v;
    versionSelect.appendChild(opt);
  });
  
  if (state.version) {
    versionSelect.value = state.version;
  } else {
    state.version = listToUse[0];
    versionSelect.value = listToUse[0];
  }
  
  updateScenarioDropdownOptions();
}

function updateScenarioDropdownOptions() {
  const select = document.getElementById("deploymentScenario");
  if (!select) return;
  
  const currentVal = select.value;
  select.innerHTML = "";
  
  if (state.platform === "ontap") {
    const options = [
      { value: "generic", label: "Generic Storage Provisioning" },
      { value: "esxi_nfs", label: "VMware ESXi Datastore Cluster (NFS)" },
      { value: "esxi_iscsi", label: "VMware ESXi Datastore Cluster (iSCSI SAN)" },
      { value: "mssql_iscsi", label: "Microsoft SQL Server Database (iSCSI SAN)" },
      { value: "oracle_fc", label: "Oracle ASM Database (Fibre Channel SAN)" },
      { value: "trident_k8s", label: "Kubernetes Container Storage (Trident CSI)" },
      { value: "mixed_enterprise", label: "Mixed Enterprise NAS & SAN Environment" }
    ];
    options.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.innerText = o.label;
      select.appendChild(opt);
    });
    if (options.some(o => o.value === currentVal)) {
      select.value = currentVal;
    } else {
      select.value = "generic";
    }
  } else {
    const options = [
      { value: "sg_generic", label: "Generic S3 Object Storage" },
      { value: "sg_compliance", label: "WORM Compliance & Archiving (Object Lock)" },
      { value: "sg_hybrid_cloud", label: "Multi-Tenant Platform Services & Hybrid Cloud Mirror" }
    ];
    options.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.innerText = o.label;
      select.appendChild(opt);
    });
    if (options.some(o => o.value === currentVal)) {
      select.value = currentVal;
    } else {
      select.value = "sg_generic";
    }
  }
}

// Populate switch version selector dropdown
function updateSwitchVersionOptions() {
  const switchVersionSelect = document.getElementById("switchVersion");
  const switchVersionGroup = document.getElementById("switchVersionGroup");
  if (!switchVersionSelect) return;

  switchVersionSelect.innerHTML = "";

  if (state.network.switchBrand === "generic") {
    switchVersionGroup.style.display = "none";
    return;
  }
  
  switchVersionGroup.style.display = "block";
  const versions = state.network.switchBrand === "cisco" ? CISCO_VERSIONS : BROCADE_VERSIONS;
  versions.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.innerText = v;
    switchVersionSelect.appendChild(opt);
  });

  if (!versions.includes(state.network.switchVersion)) {
    state.network.switchVersion = versions[0];
  }
  switchVersionSelect.value = state.network.switchVersion;
}

function renderNodeNameInputs() {
  const container = document.getElementById("nodeNamesContainer");
  if (!container) return;
  
  const nodeCount = parseInt(state.sizing.nodeCount) || 2;
  
  // Initialize customNodeNames array if needed
  while (state.customNodeNames.length < nodeCount) {
    state.customNodeNames.push(`cluster1-0${state.customNodeNames.length + 1}`);
  }
  
  // Truncate customNodeNames if node count decreased
  if (state.customNodeNames.length > nodeCount) {
    state.customNodeNames = state.customNodeNames.slice(0, nodeCount);
  }
  
  container.innerHTML = "";

  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    // MetroCluster Layout: split nodes into Site A and Site B
    container.style.display = "block";
    
    const wrapper = document.createElement("div");
    wrapper.style.display = "grid";
    wrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
    wrapper.style.gap = "20px";
    wrapper.style.width = "100%";
    
    const siteADiv = document.createElement("div");
    siteADiv.style.background = "rgba(255,255,255,0.02)";
    siteADiv.style.border = "1px solid rgba(255,255,255,0.05)";
    siteADiv.style.borderRadius = "8px";
    siteADiv.style.padding = "16px";
    siteADiv.innerHTML = `<h4 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--color-accent-cyan); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;"><i data-lucide="map-pin" style="width:16px;height:16px;"></i> Site A (Local Site)</h4>`;
    
    const siteAList = document.createElement("div");
    siteAList.style.display = "flex";
    siteAList.style.flexDirection = "column";
    siteAList.style.gap = "12px";
    siteADiv.appendChild(siteAList);
    
    const siteBDiv = document.createElement("div");
    siteBDiv.style.background = "rgba(255,255,255,0.02)";
    siteBDiv.style.border = "1px solid rgba(255,255,255,0.05)";
    siteBDiv.style.borderRadius = "8px";
    siteBDiv.style.padding = "16px";
    siteBDiv.innerHTML = `<h4 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--color-accent-blue); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;"><i data-lucide="map-pin" style="width:16px;height:16px;"></i> Site B (Remote Site)</h4>`;
    
    const siteBList = document.createElement("div");
    siteBList.style.display = "flex";
    siteBList.style.flexDirection = "column";
    siteBList.style.gap = "12px";
    siteBDiv.appendChild(siteBList);
    
    wrapper.appendChild(siteADiv);
    wrapper.appendChild(siteBDiv);
    container.appendChild(wrapper);
    
    const halfNodes = nodeCount / 2;
    
    for (let i = 0; i < nodeCount; i++) {
      const isSiteB = i >= halfNodes;
      const targetList = isSiteB ? siteBList : siteAList;
      
      const div = document.createElement("div");
      
      const label = document.createElement("label");
      const partnerIdx = isSiteB ? (i - halfNodes + 1) : (i + halfNodes + 1);
      label.innerHTML = `Node ${i + 1} Name <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal; margin-left: 6px;">(DR Peer: Node ${partnerIdx})</span>`;
      label.style.fontSize = "0.75rem";
      label.style.marginBottom = "4px";
      label.style.display = "block";
      
      const input = document.createElement("input");
      input.type = "text";
      input.className = "form-control";
      input.value = state.customNodeNames[i] || `cluster1-0${i + 1}`;
      input.addEventListener("input", (e) => {
        state.customNodeNames[i] = e.target.value;
        saveToLocalStorage();
        updateCodePreview();
      });
      
      div.appendChild(label);
      div.appendChild(input);
      targetList.appendChild(div);
    }
    safeCreateIcons();
  } else {
    // Normal layout
    container.style.display = "grid";
    for (let i = 0; i < nodeCount; i++) {
      const div = document.createElement("div");
      
      const label = document.createElement("label");
      label.innerText = `Node ${i + 1} Name`;
      label.style.fontSize = "0.75rem";
      label.style.marginBottom = "4px";
      label.style.display = "block";
      
      const input = document.createElement("input");
      input.type = "text";
      input.className = "form-control";
      input.value = state.customNodeNames[i] || `cluster1-0${i + 1}`;
      input.addEventListener("input", (e) => {
        state.customNodeNames[i] = e.target.value;
        saveToLocalStorage();
        updateCodePreview();
      });
      
      div.appendChild(label);
      div.appendChild(input);
      container.appendChild(div);
    }
  }
}

// 4. WIZARD NAVIGATION ENGINE
function showStep(step) {
  state.currentStep = parseInt(step);
  
  // Update left navigation items
  document.querySelectorAll(".nav-step").forEach(stepEl => {
    const sNum = parseInt(stepEl.getAttribute("data-step"));
    stepEl.classList.remove("active");
    if (sNum === state.currentStep) {
      stepEl.classList.add("active");
    }
    if (sNum < state.currentStep) {
      stepEl.classList.add("completed");
    } else {
      stepEl.classList.remove("completed");
    }
  });

  // Update middle wizard step panels
  document.querySelectorAll(".wizard-step-panel").forEach(panel => {
    panel.classList.remove("active");
    if (parseInt(panel.getAttribute("data-step")) === state.currentStep) {
      panel.classList.add("active");
    }
  });

  // Scroll wizard panel back to top
  document.getElementById("wizardContent").scrollTop = 0;

  // Handle footer buttons visibility/states
  const prevBtn = document.getElementById("btnPrev");
  const nextBtn = document.getElementById("btnNext");

  if (state.currentStep === 1) {
    prevBtn.style.visibility = "hidden";
  } else {
    prevBtn.style.visibility = "visible";
  }

  if (state.currentStep === 8) {
    nextBtn.style.display = "none";
  } else {
    nextBtn.style.display = "inline-flex";
    const isPenultimate = (state.platform === "storagegrid" && state.currentStep === 4) || (state.platform === "ontap" && state.currentStep === 7);
    if (isPenultimate) {
      nextBtn.innerHTML = `Review Specs <i data-lucide="check-circle"></i>`;
    } else {
      nextBtn.innerHTML = `Next <i data-lucide="arrow-right"></i>`;
    }
    safeCreateIcons();
  }

  // Refresh code preview to fit current context
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
  safeCreateIcons();
}

function nextStep() {
  let next = (parseInt(state.currentStep) || 1) + 1;
  if (state.platform === "storagegrid" && next === 5) {
    next = 8;
  }
  if (next <= 8) {
    showStep(next);
  }
}

function prevStep() {
  let prev = (parseInt(state.currentStep) || 1) - 1;
  if (state.platform === "storagegrid" && prev === 7) {
    prev = 4;
  }
  if (prev >= 1) {
    showStep(prev);
  }
}

// HELPER FUNCTIONS FOR FILE UPLOAD AND EXTRACTION
// Gzip decompression using Pako or browser native DecompressionStream fallback
async function decompressGzip(arrayBuffer) {
  if (typeof pako !== "undefined" && pako.ungzip) {
    try {
      const decompressed = pako.ungzip(new Uint8Array(arrayBuffer));
      return decompressed.buffer;
    } catch (e) {
      console.warn("Pako decompression failed, falling back to DecompressionStream:", e);
    }
  }

  if (typeof DecompressionStream !== "undefined") {
    const blob = new Blob([arrayBuffer]);
    const ds = new DecompressionStream("gzip");
    const decompressedStream = blob.stream().pipeThrough(ds);
    const response = new Response(decompressedStream);
    return await response.arrayBuffer();
  }
  
  throw new Error("Gzip decompression is not supported in this browser version. Please upload uncompressed files.");
}

// Lightweight browser-compatible untar implementation
function untar(arrayBuffer) {
  const files = [];
  const view = new DataView(arrayBuffer);
  let offset = 0;
  
  while (offset < arrayBuffer.byteLength - 512) {
    let isHeaderEmpty = true;
    for (let i = 0; i < 512; i++) {
      if (view.getUint8(offset + i) !== 0) {
        isHeaderEmpty = false;
        break;
      }
    }
    if (isHeaderEmpty) {
      offset += 512;
      continue;
    }
    
    let nameBytes = [];
    for (let i = 0; i < 100; i++) {
      const charCode = view.getUint8(offset + i);
      if (charCode === 0) break;
      nameBytes.push(charCode);
    }
    let name = String.fromCharCode(...nameBytes);
    
    let prefixBytes = [];
    for (let i = 0; i < 155; i++) {
      const charCode = view.getUint8(offset + 345 + i);
      if (charCode === 0) break;
      prefixBytes.push(charCode);
    }
    if (prefixBytes.length > 0) {
      name = String.fromCharCode(...prefixBytes) + "/" + name;
    }
    
    const typeFlag = String.fromCharCode(view.getUint8(offset + 156));
    
    let sizeBytes = [];
    for (let i = 0; i < 12; i++) {
      const charCode = view.getUint8(offset + 124 + i);
      if (charCode === 0 || charCode === 32) continue;
      sizeBytes.push(charCode);
    }
    const sizeOctal = String.fromCharCode(...sizeBytes);
    const size = parseInt(sizeOctal, 8) || 0;
    
    offset += 512;
    
    if (typeFlag === '0' || typeFlag === '\0' || typeFlag === '') {
      const actualSize = Math.min(size, arrayBuffer.byteLength - offset);
      const fileData = new Uint8Array(arrayBuffer, offset, actualSize);
      files.push({
        name: name,
        size: actualSize,
        data: fileData
      });
    }
    
    offset += Math.ceil(size / 512) * 512;
  }
  
  return files;
}

function isRelevantAsupFile(basename) {
  if (basename.startsWith("._")) return false;
  
  const includeKws = [
    "asup", "body", "log", "txt", "message", "show", "cli", "version", "vserver", "volume", "vol", 
    "aggregate", "aggr", "interface", "lif", "network", "igroup", "lun", "switch", "sysconfig", 
    "disk", "shelf", "initiator", "serial", "metrocluster", "mcc",
    "nfs", "cifs", "smb", "iscsi", "fc", "fcp", "fcoe", "nvme", "protocol", "share", "export", 
    "route", "host", "vlan", "port", "xml", "config"
  ];
  const excludeKws = ["metrics", "history", "ems", "sensor", "netstat", "sockstat", "ps-ax", "pcpconfig", "latest", "trace", "statistics", "counters", "error", "fault", "temp", "fan", "power", "sp-", "bsd-"];
  
  const isMatched = includeKws.some(kw => basename.includes(kw));
  if (!isMatched) return false;
  
  const isExcluded = excludeKws.some(ekw => basename.includes(ekw));
  if (isExcluded) return false;
  
  return true;
}

async function extract7zArchive(file) {
  const base64 = window.SEVENZIP_WASM_BASE64;
  if (!base64 || base64 === "WASM_BASE64_PLACEHOLDER") {
    throw new Error("7z WebAssembly binary is not loaded in this bundle.");
  }

  // Convert base64 to Uint8Array
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Initialize sevenzip-wasm
  const sevenZip = await SevenZipWasm({
    wasmBinary: bytes
  });

  const buffer = await file.arrayBuffer();
  const archiveData = new Uint8Array(buffer);

  // Write archive to virtual FS
  sevenZip.FS.writeFile("archive.7z", archiveData);

  // Create output directory
  sevenZip.FS.mkdir("extracted");

  // Run 7-zip command: extract 'archive.7z' to 'extracted' directory
  sevenZip.callMain(["x", "archive.7z", "-oextracted"]);

  const extractedFiles = [];
  const textDecoder = new TextDecoder("utf-8");

  // Helper function to recursively read files from MEMFS
  async function readAllFilesFromDir(dirPath) {
    const entries = sevenZip.FS.readdir(dirPath);
    for (const entry of entries) {
      if (entry === "." || entry === "..") continue;
      const fullPath = dirPath + "/" + entry;
      const stat = sevenZip.FS.stat(fullPath);
      if (sevenZip.FS.isDir(stat.mode)) {
        await readAllFilesFromDir(fullPath);
      } else {
        const fileBytes = sevenZip.FS.readFile(fullPath);
        const relativeName = fullPath.replace(new RegExp("^extracted/"), "");
        const basename = relativeName.split("/").pop().toLowerCase();
        if (!isRelevantAsupFile(basename)) continue;

        let text = "";
        if (basename.endsWith(".gz")) {
          try {
            const exactBuffer = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength);
            const decompressedBuffer = await decompressGzip(exactBuffer);
            text = textDecoder.decode(new Uint8Array(decompressedBuffer));
            extractedFiles.push({ name: relativeName.slice(0, -3), content: text });
          } catch (decompError) {
            console.warn("Failed to decompress nested .gz inside 7z:", relativeName, decompError);
            text = textDecoder.decode(fileBytes);
            extractedFiles.push({ name: relativeName, content: text });
          }
        } else {
          text = textDecoder.decode(fileBytes);
          extractedFiles.push({ name: relativeName, content: text });
        }
      }
    }
  }

  await readAllFilesFromDir("extracted");
  return extractedFiles;
}

// Extractor that unzips/untars/decompresses any archive format
async function extractFilesFromArchive(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".7z")) {
    return await extract7zArchive(file);
  }

  const buffer = await file.arrayBuffer();
  const extracted = [];
  const textDecoder = new TextDecoder("utf-8");

  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const zipEntries = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && !relativePath.startsWith("__MACOSX") && !relativePath.includes(".DS_Store")) {
        zipEntries.push(zipEntry);
      }
    });
    for (const entry of zipEntries) {
      const basename = entry.name.split("/").pop().toLowerCase();
      if (!isRelevantAsupFile(basename)) continue;
      
      if (basename.endsWith(".gz")) {
        const compressedData = await entry.async("uint8array");
        try {
          const exactBuffer = compressedData.buffer.slice(compressedData.byteOffset, compressedData.byteOffset + compressedData.byteLength);
          const decompressedBuffer = await decompressGzip(exactBuffer);
          const text = textDecoder.decode(new Uint8Array(decompressedBuffer));
          extracted.push({ name: entry.name.slice(0, -3), content: text });
        } catch (decompError) {
          console.warn("Failed to decompress nested zip .gz file:", entry.name, decompError);
          const text = textDecoder.decode(compressedData);
          extracted.push({ name: entry.name, content: text });
        }
      } else {
        const text = await entry.async("string");
        extracted.push({ name: entry.name, content: text });
      }
    }
  } else if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
    const decompressedBuffer = await decompressGzip(buffer);
    const tarFiles = untar(decompressedBuffer);
    for (const tf of tarFiles) {
      const basename = tf.name.split("/").pop().toLowerCase();
      if (!isRelevantAsupFile(basename)) continue;
      
      if (basename.endsWith(".gz")) {
        try {
          const exactBuffer = tf.data.buffer.slice(tf.data.byteOffset, tf.data.byteOffset + tf.data.byteLength);
          const decompressedBuffer = await decompressGzip(exactBuffer);
          const text = textDecoder.decode(new Uint8Array(decompressedBuffer));
          extracted.push({ name: tf.name.slice(0, -3), content: text });
        } catch (decompError) {
          console.warn("Failed to decompress nested tar.gz file:", tf.name, decompError);
          const text = textDecoder.decode(tf.data);
          extracted.push({ name: tf.name, content: text });
        }
      } else {
        const text = textDecoder.decode(tf.data);
        extracted.push({ name: tf.name, content: text });
      }
    }
  } else if (name.endsWith(".tar")) {
    const tarFiles = untar(buffer);
    for (const tf of tarFiles) {
      const basename = tf.name.split("/").pop().toLowerCase();
      if (!isRelevantAsupFile(basename)) continue;
      
      if (basename.endsWith(".gz")) {
        try {
          const exactBuffer = tf.data.buffer.slice(tf.data.byteOffset, tf.data.byteOffset + tf.data.byteLength);
          const decompressedBuffer = await decompressGzip(exactBuffer);
          const text = textDecoder.decode(new Uint8Array(decompressedBuffer));
          extracted.push({ name: tf.name.slice(0, -3), content: text });
        } catch (decompError) {
          console.warn("Failed to decompress nested tar file .gz:", tf.name, decompError);
          const text = textDecoder.decode(tf.data);
          extracted.push({ name: tf.name, content: text });
        }
      } else {
        const text = textDecoder.decode(tf.data);
        extracted.push({ name: tf.name, content: text });
      }
    }
  } else if (name.endsWith(".gz")) {
    const decompressedBuffer = await decompressGzip(buffer);
    const text = textDecoder.decode(new Uint8Array(decompressedBuffer));
    extracted.push({ name: file.name.replace(/\.gz$/, ""), content: text });
  } else {
    const text = textDecoder.decode(new Uint8Array(buffer));
    extracted.push({ name: file.name, content: text });
  }

  return extracted;
}

// HELPER FUNCTIONS FOR FILE UPLOAD AND EXTRACTION
async function handleAsupFiles(files) {
  if (!files || files.length === 0) return;
  
  updateParserBadge("loading", "Processing uploaded bundle...");
  
  let concatenatedText = "";
  let filesToProcess = Array.from(files);
  let parsedCount = 0;
  
  try {
    // 1. Direct JSON file check
    const rawJsonFile = filesToProcess.find(f => f.name.toLowerCase().endsWith(".json"));
    if (rawJsonFile) {
      const text = await rawJsonFile.text();
      const parsed = JSON.parse(text);
      if (parsed && (parsed.platform === "ontap" || parsed.platform === "storagegrid")) {
        Object.assign(state, parsed);
        syncUIWithState();
        updateParserBadge("success", "Configuration successfully imported from JSON file!");
        showStep(1);
        return;
      }
    }
    
    // 2. Process archive files
    for (const file of filesToProcess) {
      const extracted = await extractFilesFromArchive(file);
      
      // Check if any extracted file inside the archive is a configuration JSON
      const jsonEntry = extracted.find(entry => {
        const basename = entry.name.split("/").pop().toLowerCase();
        if (basename.endsWith(".json") || basename === "summary.json" || basename === "netapp_config.json") {
          try {
            const parsed = JSON.parse(entry.content);
            return parsed && (parsed.platform === "ontap" || parsed.platform === "storagegrid");
          } catch (e) {
            return false;
          }
        }
        return false;
      });
      
      if (jsonEntry) {
        const parsed = JSON.parse(jsonEntry.content);
        Object.assign(state, parsed);
        syncUIWithState();
        updateParserBadge("success", `Configuration successfully imported from config state inside archive: ${jsonEntry.name}`);
        showStep(1);
        return;
      }
      
      for (const entry of extracted) {
        const basename = entry.name.split("/").pop().toLowerCase();
        const header = detectHeaderFromContent(entry.content, basename);
        if (header) {
          concatenatedText += header + "\n" + entry.content + "\n\n";
        } else {
          concatenatedText += "::> file " + basename + "\n" + entry.content + "\n\n";
        }
        parsedCount++;
      }
    }
    
    if (concatenatedText.trim()) {
      document.getElementById("asupTextInput").value = concatenatedText;
      parseAutoSupportText(concatenatedText);
    } else {
      updateParserBadge("error", "No compatible AutoSupport command outputs identified.");
    }
  } catch (err) {
    console.error("Error processing AutoSupport bundle:", err);
    updateParserBadge("error", `Ingest failed: ${err.message || err}`);
  }
}

function mapFilenameToHeader(filename) {
  let name = filename.toLowerCase();
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex > 0) {
    name = name.substring(0, dotIndex);
  }
  
  if (name.includes("version")) {
    return "::> version";
  }
  if (name.includes("vserver")) {
    return "::> vserver show";
  }
  if (name.includes("volume") || name.includes("vol")) {
    return "::> volume show";
  }
  if (name.includes("aggregate") || name.includes("aggr")) {
    return "::> storage aggregate show";
  }
  if (name.includes("interface") || name.includes("lif") || name.includes("network")) {
    return "::> network interface show";
  }
  if (name.includes("igroup")) {
    return "::> igroup show";
  }
  
  return null;
}

function detectHeaderFromContent(content, filename) {
  let header = mapFilenameToHeader(filename);
  if (header) return header;

  const cLower = content.toLowerCase();

  if (cLower.includes("netapp release") || cLower.includes("ontap release") || cLower.includes("storagegrid release") || cLower.includes("::> version")) {
    return "::> version";
  }
  if (cLower.includes("logical") && cLower.includes("status") && cLower.includes("network") && (cLower.includes("address/mask") || cLower.includes("address")) || cLower.includes("::> network interface show") || cLower.includes("::> lif show")) {
    return "::> network interface show";
  }
  if (cLower.includes("vserver show") || (cLower.includes("vserver") && cLower.includes("subtype") && cLower.includes("operational"))) {
    return "::> vserver show";
  }
  if (cLower.includes("volume show") || (cLower.includes("vserver") && cLower.includes("volume") && (cLower.includes("percent used") || cLower.includes("aggreg")))) {
    return "::> volume show";
  }
  if (cLower.includes("storage aggregate show") || (cLower.includes("aggregate") && cLower.includes("used%") && (cLower.includes("raid status") || cLower.includes("raid status")))) {
    return "::> storage aggregate show";
  }
  if (cLower.includes("igroup show") || (cLower.includes("vserver") && cLower.includes("igroup") && cLower.includes("initiators"))) {
    return "::> igroup show";
  }
  if (cLower.includes("lun show") || (cLower.includes("vserver") && cLower.includes("lun path") && cLower.includes("mapped"))) {
    return "::> lun show";
  }

  return null;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function parseAutoSupportText(text) {
  if (!text.trim()) {
    resetParsedFieldsTracker(false);
    updateParserBadge("pending", "Waiting for paste or file upload");
    return;
  }

  // Force mode to existing and update UI selected states
  state.mode = "existing";
  document.getElementById("modeGreenfield").classList.remove("selected");
  document.getElementById("modeExisting").classList.add("selected");
  const asupArea = document.getElementById("asupInputGroup");
  if (asupArea) asupArea.style.display = "flex";

  // Helper to extract a command block from text (O(1) search + block extraction)
  function getCommandBlock(text, commandKeyword) {
    const tLower = text.toLowerCase();
    let startIdx = -1;
    let searchPos = 0;
    while (true) {
      const pos = tLower.indexOf(commandKeyword, searchPos);
      if (pos === -1) break;
      
      const beforeChar = pos > 0 ? text[pos - 1] : "\n";
      if (beforeChar === "\n" || beforeChar === ">" || beforeChar === " " || beforeChar === "*" || beforeChar === "\r") {
        startIdx = pos;
        break;
      }
      searchPos = pos + commandKeyword.length;
    }
    
    if (startIdx === -1) return "";
    
    const startLinePos = text.lastIndexOf("\n", startIdx) + 1;
    const sub = text.substring(startLinePos);
    let endIdx = sub.length;
    
    const separators = ["::>", "::*>", "::?>", "===== COMMAND", "\n====", "\r\n===="];
    for (const sep of separators) {
      const idx = sub.indexOf(sep, commandKeyword.length);
      if (idx !== -1 && idx < endIdx) {
        endIdx = idx;
      }
    }
    
    return sub.substring(0, endIdx);
  }

  let parsedAny = false;
  const tLower = text.toLowerCase();

  // Helper function to convert size strings to GB
  function sizeToGb(valStr, unitStr) {
    let size = parseFloat(valStr) || 0;
    const u = (unitStr || "").toUpperCase().trim();
    if (u.includes("TB")) return size * 1024;
    if (u.includes("GB")) return size;
    if (u.includes("MB")) return size / 1024;
    if (u.includes("KB")) return size / (1024 * 1024);
    return size;
  }

  // Helper to parse size and unit from a string like "800GB" or "1.5TB" or "500 GB"
  function parseSizeStr(str) {
    if (!str) return { val: 100, unit: "GB" };
    const m = str.match(/(\d+(?:\.\d+)?)\s*(GB|TB|MB|KB|B)/i);
    if (m) {
      let val = parseFloat(m[1]);
      let unit = m[2].toUpperCase();
      if (unit === "MB") {
        val = Math.round(val / 1024) || 1;
        unit = "GB";
      } else if (unit === "KB" || unit === "B") {
        val = 1;
        unit = "GB";
      }
      return { val, unit };
    }
    return { val: 100, unit: "GB" };
  }

  // 1. EXTRACT VERSION & SET PLATFORM/PROFILE
  const versionMatch = text.match(/NetApp Release ([\d\.]+)/i) || 
                       text.match(/ONTAP ([\d\.]+)/i) || 
                       text.match(/StorageGRID Release ([\d\.]+)/i) || 
                       text.match(/StorageGRID ([\d\.]+)/i);
  
  if (versionMatch && versionMatch[1]) {
    const vStr = versionMatch[1];
    state.version = vStr;
    state.parsedFields.version = true;
    parsedAny = true;

    // Detect StorageGRID vs ONTAP platform (specific version-based and CLI header checks)
    let detectedPlatform = "ontap";
    const sgVersionMatch = text.match(/StorageGRID Release ([\d\.]+)/i) || text.match(/StorageGRID ([\d\.]+)/i);
    if (sgVersionMatch) {
      detectedPlatform = "storagegrid";
    } else if (tLower.includes("storagegrid release") || tLower.includes("storagegrid node")) {
      detectedPlatform = "storagegrid";
    } else if (tLower.includes("volume show") || tLower.includes("vserver show") || tLower.includes("aggregate show") || tLower.includes("netapp release") || tLower.includes("ontap")) {
      detectedPlatform = "ontap";
    } else if (tLower.includes("storagegrid")) {
      if (tLower.includes("sysconfig") || tLower.includes("show") || tLower.includes("version")) {
        detectedPlatform = "ontap";
      } else {
        detectedPlatform = "storagegrid";
      }
    }
    
    state.platform = detectedPlatform;

    if (state.platform === "storagegrid") {
      state.metrocluster.enabled = false;
    } else {
      state.platform = "ontap";
      
      // Auto-detect MetroCluster synchronous DR configurations using explicit command blocks
      let isMcc = false;
      const mccShowBlock = getCommandBlock(text, "metrocluster show") || 
                           getCommandBlock(text, "metrocluster node show") || 
                           getCommandBlock(text, "metrocluster status");
      
      if (mccShowBlock) {
        const blockLower = mccShowBlock.toLowerCase();
        if (blockLower.includes("configuration state: ok") || 
            blockLower.includes("configured") || 
            (blockLower.includes("local") && blockLower.includes("remote") && !blockLower.includes("not configured") && !blockLower.includes("not enabled") && !blockLower.includes("not available"))) {
          isMcc = true;
        }
      }
      
      // Fallback: check if the text contains explicit indicators of active MetroCluster pairing
      if (!isMcc) {
        if (tLower.includes("metrocluster show") || tLower.includes("metrocluster status")) {
          if (!tLower.includes("metrocluster is not configured") && !tLower.includes("not configured")) {
            isMcc = true;
          }
        }
      }
      
      state.metrocluster.enabled = isMcc;

      if (isMcc) {
        // Auto-detect type
        if (tLower.includes("metrocluster ip") || tLower.includes("mc ip") || tLower.includes("ethernet fabric") || tLower.includes("e5a") || tLower.includes("e5b")) {
          state.metrocluster.type = "ip";
        } else if (tLower.includes("metrocluster fc") || tLower.includes("mc fc") || tLower.includes("fibre channel") || tLower.includes("fc1") || tLower.includes("fc2") || tLower.includes("brocade") || tLower.includes("fc-sw")) {
          state.metrocluster.type = "fc";
        }
        
        // Auto-detect Scale / Node count
        let scaleVal = 4;
        let foundNodes = new Set();

        const mccNodeBlock = getCommandBlock(text, "metrocluster node show") || getCommandBlock(text, "metrocluster show");
        if (mccNodeBlock) {
          const lines = mccNodeBlock.split(/\r?\n/);
          let isTableBody = false;
          for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes("-----")) {
              isTableBody = true;
              continue;
            }
            if (!isTableBody) continue;
            if (trimmed.startsWith("::>") || trimmed.startsWith("=====")) {
              break;
            }
            if (!trimmed) continue;
            
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 3) {
              let nodeName = "";
              let partnerName = "";
              if (/^\d+$/.test(parts[0])) {
                nodeName = parts[2];
                partnerName = parts[parts.length - 1];
              } else if (parts.length === 4) {
                nodeName = parts[1];
                partnerName = parts[3];
              } else if (parts.length === 3) {
                nodeName = parts[0];
                partnerName = parts[2];
              }
              
              if (nodeName && !nodeName.toLowerCase().includes("switch") && !nodeName.toLowerCase().includes("-sw")) {
                foundNodes.add(nodeName.toLowerCase());
              }
              if (partnerName && !partnerName.toLowerCase().includes("switch") && !partnerName.toLowerCase().includes("-sw")) {
                foundNodes.add(partnerName.toLowerCase());
              }
            }
          }
        }

        // Regex fallback scan over the entire document
        const matches = [
          ...text.matchAll(/\b((?:[a-zA-Z0-9_]+-)?(?:node|site|cluster|partner)[a-zA-Z0-9_]*-\d+)\b/gi),
          ...text.matchAll(/\b(node\d+|site[a-bA-B]\d+|cluster\d+)\b/gi)
        ].map(m => m[1].toLowerCase());
        
        for (const m of matches) {
          foundNodes.add(m);
        }

        const totalNodes = foundNodes.size;
        if (totalNodes >= 8) scaleVal = 8;
        else if (totalNodes >= 4) scaleVal = 4;
        else if (totalNodes >= 2) scaleVal = 2;
        
        state.metrocluster.scale = scaleVal.toString();
        state.sizing.nodeCount = scaleVal;
        
        // Auto-detect mediator
        if (tLower.includes("mediator")) {
          state.metrocluster.mediator = "mediator";
        } else if (tLower.includes("tiebreaker")) {
          state.metrocluster.mediator = "tiebreaker";
        } else {
          state.metrocluster.mediator = "none";
        }
      } else {
        state.metrocluster.enabled = false;
      }
    }
    
    // Update platform version dropdown
    const selectEl = document.getElementById("platformVersion");
    if (selectEl) {
      if (state.platform === "ontap") {
        if (!ONTAP_VERSIONS.includes(vStr)) {
          const opt = document.createElement("option");
          opt.value = vStr;
          opt.innerText = vStr;
          opt.selected = true;
          selectEl.prepend(opt);
        } else {
          selectEl.value = vStr;
        }
      } else {
        if (!STORAGEGRID_VERSIONS.includes(vStr)) {
          const opt = document.createElement("option");
          opt.value = vStr;
          opt.innerText = vStr;
          opt.selected = true;
          selectEl.prepend(opt);
        } else {
          selectEl.value = vStr;
        }
      }
    }
  }

  // 2. CONTROLLER HARDWARE AUTO-DETECTION (Boundary-safe & System Model targeted)
  let controller = "";
  let ontapPlatform = "aff";

  const sysModelMatch = text.match(/System Model:\s*([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*)/i) ||
                        text.match(/Machine Type:\s*([A-Za-z0-9_-]+)/i) ||
                        text.match(/Model Name:\s*([A-Za-z0-9_-]+)/i) ||
                        text.match(/Product Name:\s*([A-Za-z0-9_-]+)/i);

  let searchTarget = text;
  if (sysModelMatch && sysModelMatch[1]) {
    searchTarget = sysModelMatch[0]; // Restrict lookup specifically to the model line
  }

  function matchModel(target) {
    const t = target.toLowerCase();
    
    // StorageGRID
    if (/\bsg6100\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG6100" };
    if (/\bsg6160\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG6160" };
    if (/\bsg6060\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG6060" };
    if (/\bsg5800\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG5800" };
    if (/\bsg5860\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG5860" };
    if (/\bsg5812\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG5812" };
    if (/\bsg1100\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG1100" };
    if (/\bsg110\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG110" };
    if (/\bsg1000\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG1000" };
    if (/\bsg100\b/i.test(t)) return { platform: "storagegrid", ctrl: "SG100" };

    // ASA
    if (/\basa\b.*\ba1k\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A1K" };
    if (/\basa\b.*\ba90\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A90" };
    if (/\basa\b.*\ba70\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A70" };
    if (/\basa\b.*\ba50\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A50" };
    if (/\basa\b.*\ba30\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A30" };
    if (/\basa\b.*\ba20\b/i.test(t) || /\basa\b.*\ba200\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A20" };
    if (/\basa\b.*\bc80\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_C80" };
    if (/\basa\b.*\bc60\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_C60" };
    if (/\basa\b.*\bc30\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_C30" };
    if (/\basa\b.*\ba900\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A900" };
    if (/\basa\b.*\ba400\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A400" };
    if (/\basa\b.*\ba250\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A250" };
    if (/\basa\b.*\ba150\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_A150" };
    if (/\basa\b.*\bc800\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_C800" };
    if (/\basa\b.*\bc400\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_C400" };
    if (/\basa\b.*\bc250\b/i.test(t)) return { platform: "ontap", profile: "asa", ctrl: "ASA_C250" };

    // AFF
    if (/\ba1k\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A1K" };
    if (/\ba90\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A90" };
    if (/\ba70\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A70" };
    if (/\ba50\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A50" };
    if (/\ba30\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A30" };
    if (/\ba20\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A20" };
    if (/\bc80\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "C80" };
    if (/\bc60\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "C60" };
    if (/\bc30\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "C30" };
    if (/\ba900\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A900" };
    if (/\ba400\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A400" };
    if (/\ba250\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A250" };
    if (/\ba150\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "A150" };
    if (/\bc800\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "C800" };
    if (/\bc400\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "C400" };
    if (/\bc250\b/i.test(t)) return { platform: "ontap", profile: "aff", ctrl: "C250" };

    // FAS
    if (/\bfas70\b/i.test(t)) return { platform: "ontap", profile: "fas", ctrl: "FAS70" };
    if (/\bfas9500\b/i.test(t) || /\bfas9000\b/i.test(t)) return { platform: "ontap", profile: "fas", ctrl: "FAS9500" };
    if (/\bfas8700\b/i.test(t) || /\bfas8200\b/i.test(t)) return { platform: "ontap", profile: "fas", ctrl: "FAS8700" };
    if (/\bfas8300\b/i.test(t)) return { platform: "ontap", profile: "fas", ctrl: "FAS8300" };
    if (/\bfas2820\b/i.test(t) || /\bfas2720\b/i.test(t) || /\bfas2750\b/i.test(t)) return { platform: "ontap", profile: "fas", ctrl: "FAS2820" };

    return null;
  }

  const matchedRes = matchModel(searchTarget);
  if (matchedRes) {
    state.platform = matchedRes.platform;
    if (matchedRes.platform === "ontap") {
      ontapPlatform = matchedRes.profile;
    }
    controller = matchedRes.ctrl;
  }

  if (!controller && sysModelMatch && sysModelMatch[1]) {
    const rawModel = sysModelMatch[1].trim();
    if (rawModel.length > 2) {
      controller = rawModel.toUpperCase().replace(/-/g, "_");
      if (controller.startsWith("ASA")) {
        state.platform = "ontap";
        ontapPlatform = "asa";
      } else if (controller.startsWith("FAS")) {
        state.platform = "ontap";
        ontapPlatform = "fas";
      } else if (controller.startsWith("SG") || controller.startsWith("STORAGEGRID")) {
        state.platform = "storagegrid";
      } else {
        state.platform = "ontap";
        ontapPlatform = "aff";
      }
    }
  }

  // Translate NetApp motherboard part numbers to actual platform models
  function translatePartNumberToModel(partNo, tLower) {
    const cleanPart = partNo.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
    
    if (cleanPart.includes("11103048") || cleanPart.includes("11103049") || cleanPart.includes("11103050") || cleanPart.includes("11103070")) {
      if (tLower.includes("c250")) return { platform: "ontap", profile: "aff", ctrl: "C250" };
      if (tLower.includes("asa")) return { platform: "ontap", profile: "asa", ctrl: "ASA_A250" };
      return { platform: "ontap", profile: "aff", ctrl: "A250" };
    }
    if (cleanPart.includes("11103719") || cleanPart.includes("11103720")) {
      if (tLower.includes("c400")) return { platform: "ontap", profile: "aff", ctrl: "C400" };
      if (tLower.includes("asa")) return { platform: "ontap", profile: "asa", ctrl: "ASA_A400" };
      return { platform: "ontap", profile: "aff", ctrl: "A400" };
    }
    if (cleanPart.includes("11104210") || cleanPart.includes("11104211")) {
      if (tLower.includes("asa")) return { platform: "ontap", profile: "asa", ctrl: "ASA_A900" };
      return { platform: "ontap", profile: "aff", ctrl: "A900" };
    }
    if (cleanPart.includes("11105710") || cleanPart.includes("11105711")) {
      if (tLower.includes("asa")) return { platform: "ontap", profile: "asa", ctrl: "ASA_A90" };
      return { platform: "ontap", profile: "aff", ctrl: "A90" };
    }
    if (cleanPart.includes("11105810") || cleanPart.includes("11105811")) {
      if (tLower.includes("asa")) return { platform: "ontap", profile: "asa", ctrl: "ASA_A70" };
      return { platform: "ontap", profile: "aff", ctrl: "A70" };
    }
    if (cleanPart.includes("11106010") || cleanPart.includes("11106011")) {
      if (tLower.includes("asa")) return { platform: "ontap", profile: "asa", ctrl: "ASA_A1K" };
      return { platform: "ontap", profile: "aff", ctrl: "A1K" };
    }
    if (cleanPart.includes("11101810") || cleanPart.includes("11101811")) {
      if (tLower.includes("fas")) return { platform: "ontap", profile: "fas", ctrl: "FAS2820" };
      return { platform: "ontap", profile: "aff", ctrl: "A150" };
    }
    if (cleanPart.includes("11101930") || cleanPart.includes("11101931")) {
      if (tLower.includes("fas")) return { platform: "ontap", profile: "fas", ctrl: "FAS8700" };
      return { platform: "ontap", profile: "aff", ctrl: "A400" };
    }
    if (cleanPart.includes("11103910") || cleanPart.includes("11103911")) {
      if (tLower.includes("fas8700")) return { platform: "ontap", profile: "fas", ctrl: "FAS8700" };
      return { platform: "ontap", profile: "fas", ctrl: "FAS8300" };
    }
    return null;
  }

  if (controller) {
    const cleanCtrl = controller.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
    const isPartNumber = /^\d{3}\d{5}/.test(cleanCtrl) || cleanCtrl.includes("111") || cleanCtrl.startsWith("80");
    if (isPartNumber) {
      const translated = translatePartNumberToModel(controller, tLower);
      if (translated) {
        state.platform = translated.platform;
        if (translated.platform === "ontap") {
          ontapPlatform = translated.profile;
        }
        controller = translated.ctrl;
      }
    }
  }

  if (controller) {
    state.sizing.controller = controller;
    state.ontapPlatform = ontapPlatform;
    state.parsedFields.controller = true;
    parsedAny = true;
  }

  // 3. NODE COUNT
  if (state.platform === "ontap" && state.metrocluster.enabled) {
    // MetroCluster node count is already set in phase 1, do not overwrite it with standard detection
  } else {
    const nodeMatches = [...new Set([...text.matchAll(/(?:cluster\d+-|node-|node|nvme-node-)(\d+)/gi)].map(m => m[0].toLowerCase()))];
    if (nodeMatches.length > 0) {
      let count = nodeMatches.length;
      if (state.platform === "ontap") {
        if (count <= 2) count = 2;
        else if (count <= 4) count = 4;
        else count = 8;
      } else {
        count = Math.max(1, Math.min(16, count));
      }
      state.sizing.nodeCount = count;
      state.parsedFields.nodeCount = true;
      parsedAny = true;
    }
  }

  // 4. SHELF TYPE DETECT
  let shelfType = "";
  if (state.platform === "storagegrid") {
    if (controller === "VMware_VM" || controller === "Software_Node") {
      shelfType = "VMDK";
    } else if (controller === "SG5812" || controller === "SG5712") {
      shelfType = "built_in_12";
    } else if (controller === "SG100" || controller === "SG110" || controller === "SG1000" || controller === "SG1100") {
      shelfType = "none";
    } else {
      shelfType = "built_in_60";
    }
  } else {
    if (tLower.includes("ns224") || controller.startsWith("A") || controller.startsWith("ASA_A") || controller.startsWith("C")) {
      shelfType = "NS224";
    } else if (tLower.includes("ds224c") || tLower.includes("ds224")) {
      shelfType = "DS224C";
    } else if (tLower.includes("ds212c") || tLower.includes("ds212")) {
      shelfType = "DS212C";
    } else {
      shelfType = "NS224";
    }
  }
  if (shelfType) {
    state.sizing.shelfType = shelfType;
    state.parsedFields.shelfType = true;
    parsedAny = true;
  }

  // 5. DISK SIZE AUTO-DETECTION
  const diskSizesList = [
    "30.6TB", "15.3TB", "7.6TB", "3.8TB", "1.9TB", "960GB",
    "22TB", "20TB", "18TB", "16TB", "12TB", "8TB", "4TB",
    "1.6TB SSD", "7.6TB SSD"
  ];
  let diskSize = "";
  for (const sz of diskSizesList) {
    const cleanSz = sz.toLowerCase().replace(/\s+/g, "");
    const spacedSz = sz.toLowerCase().replace("tb", " tb").replace("gb", " gb");
    if (tLower.includes(sz.toLowerCase()) || tLower.includes(cleanSz) || tLower.includes(spacedSz)) {
      diskSize = sz;
      break;
    }
  }
  if (diskSize) {
    state.sizing.diskSize = diskSize;
    state.parsedFields.diskSize = true;
    parsedAny = true;
  }

  // Extract LIF and Interface command block to parse network IPs, SVMs, and management info
  const lifBlock = getCommandBlock(text, "network interface show") || getCommandBlock(text, "lif show");
  const lifLines = lifBlock.split("\n");

  // 6. MANAGEMENT IP PARSING (Restricted to lifBlock or first 50,000 chars of file)
  let mgmtIp = "";
  for (const line of lifLines) {
    if (line.toLowerCase().includes("mgmt") && !line.toLowerCase().includes("vserver")) {
      const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch) {
        mgmtIp = ipMatch[1];
        break;
      }
    }
  }
  if (!mgmtIp) {
    const sample = text.substring(0, 50000).split("\n");
    for (const line of sample) {
      if (line.toLowerCase().includes("mgmt") && !line.toLowerCase().includes("vserver")) {
        const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (ipMatch) {
          mgmtIp = ipMatch[1];
          break;
        }
      }
    }
  }
  if (mgmtIp) {
    state.network.mgmtIp = mgmtIp;
    state.parsedFields.mgmtIp = true;
    parsedAny = true;
  }

  // 7. SVM NAMES, DATA IPS & NETWORK INTERFACES
  let lifIpMap = {}; // Maps SVM name to array of LIF IPs/WWPNs
  let currentVserver = null;

  for (const line of lifLines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("---") || trimmed.startsWith("Vserver") || trimmed.startsWith("-----------")) continue;

    const parts = trimmed.split(/\s+/);
    const startsWithWhitespace = /^\s+/.test(line);

    if (!startsWithWhitespace) {
      if (parts[0].toLowerCase() === "vserver" || parts[0].startsWith("---")) {
        continue;
      }
      currentVserver = parts[0];

      if (parts.length >= 4) {
        let foundAddress = null;
        for (let i = 1; i < parts.length; i++) {
          const ipMatch = parts[i].match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (ipMatch) {
            foundAddress = ipMatch[1];
            break;
          }
          const wwpnMatch = parts[i].match(/(?:[0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}/);
          if (wwpnMatch) {
            foundAddress = wwpnMatch[0];
            break;
          }
        }
        if (foundAddress && !currentVserver.toLowerCase().startsWith("cluster") && !currentVserver.toLowerCase().startsWith("node") && currentVserver.toLowerCase() !== "admin") {
          if (!lifIpMap[currentVserver]) lifIpMap[currentVserver] = [];
          if (!lifIpMap[currentVserver].includes(foundAddress)) {
            lifIpMap[currentVserver].push(foundAddress);
          }
        }
      }
    } else {
      if (currentVserver && !currentVserver.toLowerCase().startsWith("cluster") && !currentVserver.toLowerCase().startsWith("node") && currentVserver.toLowerCase() !== "admin") {
        let foundAddress = null;
        for (let i = 0; i < parts.length; i++) {
          const ipMatch = parts[i].match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (ipMatch) {
            foundAddress = ipMatch[1];
            break;
          }
          const wwpnMatch = parts[i].match(/(?:[0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}/);
          if (wwpnMatch) {
            foundAddress = wwpnMatch[0];
            break;
          }
        }
        if (foundAddress) {
          if (!lifIpMap[currentVserver]) lifIpMap[currentVserver] = [];
          if (!lifIpMap[currentVserver].includes(foundAddress)) {
            lifIpMap[currentVserver].push(foundAddress);
          }
        }
      }
    }
  }

  // Parse SVMs from vserver show and other commands
  let discoveredVservers = new Set();
  Object.keys(lifIpMap).forEach(v => discoveredVservers.add(v));

  const vserverBlock = getCommandBlock(text, "vserver show");
  const vserverLines = vserverBlock.split("\n");
  for (const line of vserverLines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("---") || trimmed.startsWith("Vserver") || trimmed.startsWith("-----------")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && parts[1] === "data") {
      discoveredVservers.add(parts[0]);
    }
  }

  // Filter out system Vservers
  const systemNames = ["admin", "node", "cluster", "vserver", "volume", "aggregate", "percent", "size", "state", "type", "mapped", "igroup", "initiators", "logical", "status"];
  let cleanVservers = [...discoveredVservers].filter(v => {
    const l = v.toLowerCase();
    return !systemNames.some(sys => l.startsWith(sys)) && !l.includes("---");
  });

  if (cleanVservers.length === 0) {
    const svmMatches = [...new Set([...text.matchAll(/svm_[a-zA-Z0-9_]+/g)].map(m => m[0]))];
    cleanVservers = svmMatches;
  }

  let svms = [];
  cleanVservers.forEach((name, idx) => {
    let dataIp = "192.168.20.21";
    if (lifIpMap[name] && lifIpMap[name].length > 0) {
      const ipOnly = lifIpMap[name].find(addr => addr.includes("."));
      dataIp = ipOnly || lifIpMap[name][0];
    } else {
      dataIp = `192.168.20.${21 + idx}`;
    }
    svms.push({ id: idx + 1, name, dataIp, fromAsup: true });
  });

  if (svms.length === 0) {
    svms.push({ id: 1, name: "svm_data", dataIp: "192.168.20.21", fromAsup: true });
  }

  state.svms = svms;
  state.parsedFields.svmName = true;
  parsedAny = true;

  // 8. AGGREGATES & CAPACITY ESTIMATOR
  let aggregates = [];
  let totalAggrSizeGb = 0;
  let parsedRaidType = "";

  const aggrBlock = getCommandBlock(text, "storage aggregate show") || getCommandBlock(text, "aggr show");
  const aggrLines = aggrBlock.split("\n");
  for (const line of aggrLines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("---") || trimmed.startsWith("Aggregate") || trimmed.startsWith("---------")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length > 0 && parts[0] !== "" && !parts[0].includes("::>")) {
      // Validate that parts[1] is a valid size block to avoid parsing footer rows
      let isValidAggrRow = false;
      if (parts[1]) {
        const sizeMatch = parts[1].match(/^\d+(?:\.\d+)?\s*(GB|TB|MB|KB|B)?$/i);
        if (sizeMatch) {
          isValidAggrRow = true;
        }
      }
      if (!isValidAggrRow) continue;

      const aggrName = parts[0];
      aggregates.push(aggrName);

      // Sum size if available
      if (parts[1]) {
        const sizeObj = parseSizeStr(parts[1]);
        totalAggrSizeGb += sizeToGb(sizeObj.val, sizeObj.unit);
      }

      // Detect RAID Type
      const rStatus = line.toLowerCase();
      if (rStatus.includes("raid_tec") || rStatus.includes("raid-tec")) {
        parsedRaidType = "raid_tec";
      } else if (rStatus.includes("raid_dp") || rStatus.includes("raid-dp")) {
        parsedRaidType = "raid_dp";
      } else if (rStatus.includes("raid0") || rStatus.includes("raid_0")) {
        parsedRaidType = "raid0";
      }
    }
  }

  if (aggregates.length === 0) {
    aggregates = [...new Set([...text.matchAll(/aggr_[a-zA-Z0-9_]+/g)].map(m => m[0]))];
  }

  if (aggregates.length > 0) {
    state.parsedFields.aggrName = true;
    parsedAny = true;

    // Set Prefix
    const firstAggr = aggregates[0];
    const prefixMatch = firstAggr.match(/^([a-zA-Z_-]+?\d*?)(?:_\d+)?$/);
    if (prefixMatch) {
      state.sizing.aggrNamePrefix = prefixMatch[1].replace(/_\d+$/, "");
    }

    if (parsedRaidType) {
      state.sizing.raidType = parsedRaidType;
    }
  }

  // Estimate Disk Count based on capacity if totalAggrSizeGb > 0
  if (totalAggrSizeGb > 0) {
    const diskSizeGb = sizeToGb(state.sizing.diskSize.replace(/[^\d\.]/g, ""), state.sizing.diskSize.includes("TB") ? "TB" : "GB");
    if (diskSizeGb > 0) {
      // Account for RAID/Spare/Reserve (~35% overhead)
      const estimatedRawGb = totalAggrSizeGb * 1.35;
      let estimatedDisks = Math.round(estimatedRawGb / diskSizeGb);

      // Align to closest dropdown values
      let diskOptions = [12, 24, 36, 48, 72, 96, 120, 144];
      if (state.sizing.shelfType === "DS212C") {
        diskOptions = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144];
      }
      let closestDisks = diskOptions[0];
      let minDiff = Math.abs(estimatedDisks - closestDisks);
      for (const opt of diskOptions) {
        const diff = Math.abs(estimatedDisks - opt);
        if (diff < minDiff) {
          minDiff = diff;
          closestDisks = opt;
        }
      }
      state.sizing.diskCount = closestDisks;
      state.parsedFields.diskCount = true;
    }
  }

  // 9. VOLUMES
  let volumes = [];
  let colVolVserver = 0;
  let colVolName = 1;
  let colVolAggr = 2;

  const volBlock = getCommandBlock(text, "volume show") || getCommandBlock(text, "vol show");
  const volLines = volBlock.split("\n");
  for (const line of volLines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("---") || trimmed.startsWith("---------")) continue;
    if (trimmed.toLowerCase().includes("volume") && trimmed.toLowerCase().includes("vserver")) {
      const headers = trimmed.toLowerCase().split(/\s+/);
      const idxVserver = headers.indexOf("vserver");
      const idxVol = headers.indexOf("volume");
      const idxAggr = headers.indexOf("aggregate");
      if (idxVserver >= 0) colVolVserver = idxVserver;
      if (idxVol >= 0) colVolName = idxVol;
      if (idxAggr >= 0) colVolAggr = idxAggr;
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const vserverName = parts[colVolVserver] || parts[0];
      const volumeName = parts[colVolName] || parts[1];
      const aggregateName = parts[colVolAggr] || parts[2] || (aggregates[0] || "aggr1");
      
      if (vserverName.toLowerCase() === "vserver" || vserverName.startsWith("---") || volumeName.toLowerCase() === "volume" || volumeName.startsWith("---")) continue;

      let sizeObj = null;
      for (const part of parts) {
        const m = part.match(/^(\d+(?:\.\d+)?)\s*(GB|TB|MB|KB|B)$/i);
        if (m) {
          sizeObj = parseSizeStr(part);
          break;
        }
      }

      if (!sizeObj) continue;

      // Dynamically add SVM if not already present
      let svm = state.svms.find(s => s.name === vserverName);
      if (!svm) {
        const isSystem = systemNames.some(sys => vserverName.toLowerCase().startsWith(sys)) || vserverName.includes("---");
        if (!isSystem) {
          const nextId = state.svms.length + 1;
          const dataIp = (lifIpMap[vserverName] && lifIpMap[vserverName][0]) || `192.168.20.${20 + nextId}`;
          svm = { id: nextId, name: vserverName, dataIp, fromAsup: true };
          state.svms.push(svm);
        }
      }
      
      volumes.push({
        id: volumes.length + 1,
        name: volumeName,
        svmName: vserverName,
        aggregate: aggregateName,
        size: sizeObj.val,
        originalSize: sizeObj.val,
        sizeUnit: sizeObj.unit,
        encryption: volumeName.toLowerCase().includes("enc") || tLower.includes("encryption: true"),
        fabricpool: tLower.includes("fabricpool") && aggregateName.toLowerCase().includes("tier") ? "auto" : "none",
        iops: 1000,
        luns: [],
        fromAsup: true
      });
    }
  }
  
  if (volumes.length === 0) {
    const volMatches = [...new Set([...text.matchAll(/vol_[a-zA-Z0-9_]+/g)].map(m => m[0]))];
    volMatches.forEach((v, idx) => {
      let svmName = state.svms[0] ? state.svms[0].name : "svm_data";
      volumes.push({
        id: idx + 1,
        name: v,
        svmName: svmName,
        aggregate: aggregates[0] || "aggr1",
        size: 100,
        originalSize: 100,
        sizeUnit: "GB",
        encryption: false,
        fabricpool: "none",
        iops: 1000,
        luns: [],
        fromAsup: true
      });
    });
  }

  if (volumes.length > 0) {
    state.volumes = volumes;
    state.parsedFields.volName = true;
    parsedAny = true;
  }

  // 10. LUN CONFIGURATIONS & MAPPINGS
  let lunsParsed = false;
  let colLunVserver = 0;
  let colLunPath = 1;
  let colLunType = 4;

  const lunBlock = getCommandBlock(text, "lun show");
  const lunLines = lunBlock.split("\n");
  for (const line of lunLines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("---") || trimmed.startsWith("---------")) continue;
    if (trimmed.toLowerCase().includes("vserver") && (trimmed.toLowerCase().includes("lun path") || trimmed.toLowerCase().includes("path"))) {
      const headers = trimmed.toLowerCase().split(/\s+/);
      const idxVserver = headers.indexOf("vserver");
      const idxPath = headers.indexOf("path");
      if (idxPath < 0) {
        const idxLun = headers.indexOf("lun");
        if (idxLun >= 0) colLunPath = idxLun;
      } else {
        colLunPath = idxPath;
      }
      const idxType = headers.indexOf("type");
      if (idxVserver >= 0) colLunVserver = idxVserver;
      if (idxType >= 0) colLunType = idxType;
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && (parts[1].includes("/vol/") || parts[0].includes("/vol/"))) {
      let vserverName = "";
      let path = "";
      if (parts[0].includes("/vol/")) {
        path = parts[0];
        vserverName = state.svms[0] ? state.svms[0].name : "svm_data";
      } else {
        vserverName = parts[colLunVserver] || parts[0];
        path = parts[colLunPath] || parts[1];
      }

      const osType = parts[colLunType] || parts[4] || "linux";
      
      let sizeObj = null;
      for (const part of parts) {
        const m = part.match(/^(\d+(?:\.\d+)?)\s*(GB|TB|MB|KB|B)$/i);
        if (m) {
          sizeObj = parseSizeStr(part);
          break;
        }
      }
      if (!sizeObj) {
        sizeObj = parseSizeStr(parts[5]);
      }

      const pathParts = path.split('/');
      const volIdx = pathParts.indexOf('vol') >= 0 ? pathParts.indexOf('vol') + 1 : 2;
      const volumeName = pathParts[volIdx] || "";
      const lunName = pathParts[pathParts.length - 1] || "";

      // Dynamically add Vserver if not in list
      let svm = state.svms.find(s => s.name === vserverName);
      if (!svm) {
        const isSystem = systemNames.some(sys => vserverName.toLowerCase().startsWith(sys)) || vserverName.includes("---");
        if (!isSystem) {
          const nextId = state.svms.length + 1;
           const dataIp = (lifIpMap[vserverName] && lifIpMap[vserverName][0]) || `192.168.20.${20 + nextId}`;
          svm = { id: nextId, name: vserverName, dataIp, fromAsup: true };
          state.svms.push(svm);
        }
      }

      // Dynamically add parent volume if not in list
      let parentVol = state.volumes.find(v => v.name === volumeName && v.svmName === vserverName);
      if (!parentVol && volumeName !== "") {
        const nextVolId = state.volumes.length + 1;
        parentVol = {
          id: nextVolId,
          name: volumeName,
          svmName: vserverName,
          aggregate: aggregates[0] || "aggr1",
          size: sizeObj.val * 1.2,
          originalSize: sizeObj.val * 1.2,
          sizeUnit: sizeObj.unit,
          encryption: false,
          fabricpool: "none",
          iops: 1000,
          luns: [],
          fromAsup: true
        };
        state.volumes.push(parentVol);
      }

      if (!parentVol && state.volumes.length > 0) {
        parentVol = state.volumes[0];
      }

      if (parentVol) {
        if (!parentVol.luns) parentVol.luns = [];
        const existLun = parentVol.luns.find(l => l.name === lunName);
        if (!existLun) {
          parentVol.luns.push({
            id: parentVol.luns.length + 1,
            name: lunName,
            size: sizeObj.val,
            originalSize: sizeObj.val,
            sizeUnit: sizeObj.unit,
            osType: osType,
            fromAsup: true
          });
          lunsParsed = true;
          parsedAny = true;
        }
      }
    }
  }

  // 11. HOST INITIATORS & PROTOCOLS AUTO-DETECTION
  let initiators = [];
  let igroups = [];
  const iqnRegex = /iqn\.\d{4}-\d{2}\.[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+/gi;
  const wwpnRegex = /(?:[0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}/gi;
  const nqnRegex = /nqn\.\d{4}-\d{2}\.org\.nvmexpress:uuid:[a-zA-Z0-9.-]+/gi;

  const igroupBlock = getCommandBlock(text, "igroup show");
  const foundIqns = igroupBlock.match(iqnRegex);
  const foundWwpns = igroupBlock.match(wwpnRegex);
  const foundNqns = igroupBlock.match(nqnRegex);

  if (foundIqns) initiators.push(...foundIqns);
  if (foundWwpns) initiators.push(...foundWwpns);
  if (foundNqns) initiators.push(...foundNqns);

  const igroupLines = igroupBlock.split("\n");
  let currentIgroup = null;
  for (const line of igroupLines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("---") || trimmed.startsWith("Vserver") || trimmed.startsWith("-----------")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 5) {
      const protocol = parts[2].toLowerCase();
      const validProtos = ["iscsi", "fcp", "fc", "fcoe", "nvme", "mixed"];
      if (!validProtos.includes(protocol)) continue;

      const vserver = parts[0];
      const igroupName = parts[1];
      const osType = parts[3];
      const initiator = parts[4];
      currentIgroup = { vserver, igroupName, protocol, osType, initiators: [initiator] };
      igroups.push(currentIgroup);

      // Dynamically add SVM if not already present
      let svm = state.svms.find(s => s.name === vserver);
      if (!svm) {
        const isSystem = systemNames.some(sys => vserver.toLowerCase().startsWith(sys)) || vserver.includes("---");
        if (!isSystem) {
          const nextId = state.svms.length + 1;
          const dataIp = (lifIpMap[vserver] && lifIpMap[vserver][0]) || `192.168.20.${20 + nextId}`;
          svm = { id: nextId, name: vserver, dataIp };
          state.svms.push(svm);
        }
      }
    } else if (parts.length === 1 && currentIgroup && parts[0] !== "") {
      currentIgroup.initiators.push(parts[0]);
    }
  }

  // Add parsed protocols to state.protocols
  let parsedProtocols = [];
  if (igroups.length > 0) {
    igroups.forEach(ig => {
      let protoKey = ig.protocol;
      if (protoKey === "fcp") protoKey = "fc";
      if (protoKey === "nvme") protoKey = "nvme_tcp"; // Default NVMe target
      if (!parsedProtocols.includes(protoKey)) {
        parsedProtocols.push(protoKey);
      }

      // Sync specific igroup variables
      if (protoKey === "iscsi") {
        state.protocolData.iscsi.initiatorIqn = ig.initiators[0] || state.protocolData.iscsi.initiatorIqn;
      } else if (protoKey === "fc") {
        state.protocolData.fc.igroupName = ig.igroupName;
        state.protocolData.fc.initiatorWwpn = ig.initiators.join(", ");
      } else if (protoKey === "fcoe") {
        state.protocolData.fcoe.igroupName = ig.igroupName;
        state.protocolData.fcoe.initiatorWwpn = ig.initiators.join(", ");
      } else if (protoKey === "nvme_tcp" || protoKey === "nvme_fc") {
        state.protocolData.nvme_tcp.hostNqn = ig.initiators[0];
        state.protocolData.nvme_tcp.subsystem = ig.igroupName;
        state.protocolData.nvme_fc.hostNqn = ig.initiators[0];
        state.protocolData.nvme_fc.subsystem = ig.igroupName;
      }
    });
  }

  // Check file protocol triggers (NFS exports & CIFS shares)
  if (tLower.includes("export-policy") || tLower.includes("export policy") || tLower.includes("nfs show")) {
    if (!parsedProtocols.includes("nfs")) parsedProtocols.push("nfs");
    const clientMatch = text.match(/clientmatch\s*(\S+)/i) || text.match(/client-match\s*(\S+)/i);
    if (clientMatch) {
      state.protocolData.nfs.clientMatch = clientMatch[1];
    }
  }
  if (tLower.includes("cifs share") || tLower.includes("cifs show") || tLower.includes("smb share")) {
    if (!parsedProtocols.includes("smb")) parsedProtocols.push("smb");
    const shareMatch = text.match(/share\s*name\s*(\S+)/i) || text.match(/share-name\s*(\S+)/i);
    if (shareMatch) {
      state.protocolData.smb.shareName = shareMatch[1];
    }
  }

  // Fallback to active protocols based on found data signatures
  if (!parsedProtocols.includes("iscsi") && foundIqns) {
    parsedProtocols.push("iscsi");
  }
  if (!parsedProtocols.includes("fc") && foundWwpns) {
    parsedProtocols.push("fc");
  }
  if (!parsedProtocols.includes("nvme_tcp") && foundNqns) {
    parsedProtocols.push("nvme_tcp");
  }

  if (parsedProtocols.length > 0) {
    state.protocols = parsedProtocols;
    state.protocol = parsedProtocols[0];
    state.parsedFields.initiators = true;
    parsedAny = true;
  } else if (initiators.length > 0) {
    initiators = [...new Set(initiators)];
    state.protocolData.iscsi.initiatorIqn = initiators.find(i => i.startsWith("iqn.")) || state.protocolData.iscsi.initiatorIqn;
    state.protocolData.fc.initiatorWwpn = initiators.filter(i => !i.startsWith("iqn.") && !i.startsWith("nqn.")).join(", ") || state.protocolData.fc.initiatorWwpn;
    state.protocolData.fcoe.initiatorWwpn = initiators.filter(i => !i.startsWith("iqn.") && !i.startsWith("nqn.")).join(", ") || state.protocolData.fcoe.initiatorWwpn;
    state.protocolData.nvme_tcp.hostNqn = initiators.find(i => i.startsWith("nqn.")) || state.protocolData.nvme_tcp.hostNqn;
    state.protocolData.nvme_fc.hostNqn = initiators.find(i => i.startsWith("nqn.")) || state.protocolData.nvme_fc.hostNqn;
    state.parsedFields.initiators = true;
    parsedAny = true;
  }

  // 12. SWITCH & FABRIC NETWORK CONFIGURATION INGESTION
  let detectedSwitchBrand = null;
  let detectedPortSpeed = null;
  let detectedMtu = "1500";
  let detectedVlanId = null;
  let detectedZoning = false;

  // Scan text for switch brand keywords
  if (tLower.includes("cisco") || tLower.includes("nexus") || tLower.includes("mds-") || tLower.includes("mds9")) {
    detectedSwitchBrand = "cisco";
  } else if (tLower.includes("brocade") || tLower.includes("g620") || tLower.includes("g630") || tLower.includes("g720") || tLower.includes("broadcom")) {
    detectedSwitchBrand = "brocade";
  }

  // Scan text for VLAN IDs in interfaces
  const portVlanRegex = /\be\d[a-z](?:-|\.)(\d{1,4})\b/i;
  const vlanMatch = text.match(portVlanRegex);
  if (vlanMatch) {
    const vId = parseInt(vlanMatch[1]);
    if (vId >= 1 && vId <= 4094) {
      detectedVlanId = vId;
    }
  }
  
  if (!detectedVlanId) {
    const vlanWordMatch = text.match(/vlan\s*(?:id)?\s*[:=]?\s*(\d{1,4})/i);
    if (vlanWordMatch) {
      const vId = parseInt(vlanWordMatch[1]);
      if (vId >= 1 && vId <= 4094) {
        detectedVlanId = vId;
      }
    }
  }

  // Scan for MTU (e.g. MTU 9000, mtu: 9000, MTU=9000)
  if (tLower.includes("mtu 9000") || tLower.includes("mtu: 9000") || tLower.includes("mtu=9000") || tLower.includes("jumbo frame") || tLower.includes("9000 mtu")) {
    detectedMtu = "9000";
  } else if (tLower.includes("mtu 1500") || tLower.includes("mtu: 1500") || tLower.includes("mtu=1500")) {
    detectedMtu = "1500";
  }

  // Scan for Port Speed
  if (tLower.includes("100g") || tLower.includes("100 gb") || tLower.includes("100gb")) {
    detectedPortSpeed = "100";
  } else if (tLower.includes("40g") || tLower.includes("40 gb") || tLower.includes("40gb")) {
    detectedPortSpeed = "40";
  } else if (tLower.includes("25g") || tLower.includes("25 gb") || tLower.includes("25gb")) {
    detectedPortSpeed = "25";
  } else if (tLower.includes("10g") || tLower.includes("10 gb") || tLower.includes("10gb")) {
    detectedPortSpeed = "10";
  } else if (tLower.includes("64g fc") || tLower.includes("64gb fc") || tLower.includes("64g fibre") || tLower.includes("64g fcp")) {
    detectedPortSpeed = "64_fc";
  } else if (tLower.includes("32g fc") || tLower.includes("32gb fc") || tLower.includes("32g fibre") || tLower.includes("32g fcp")) {
    detectedPortSpeed = "32_fc";
  } else if (tLower.includes("16g fc") || tLower.includes("16gb fc") || tLower.includes("16g fibre") || tLower.includes("16g fcp")) {
    detectedPortSpeed = "16_fc";
  }

  // Check for zoning status
  if (tLower.includes("zoning: enabled") || tLower.includes("zoning: true") || tLower.includes("zone member") || tLower.includes("zoneset")) {
    detectedZoning = true;
  }

  // Apply network configurations
  if (detectedSwitchBrand) {
    state.network.switchBrand = detectedSwitchBrand;
    state.parsedFields.switchBrand = true;
  }
  if (detectedPortSpeed) {
    state.network.portSpeed = detectedPortSpeed;
    state.parsedFields.portSpeed = true;
  }
  state.network.mtu = detectedMtu;
  state.parsedFields.mtu = true;

  if (detectedVlanId) {
    state.network.vlanId = detectedVlanId;
    state.parsedFields.vlanId = true;
  }
  
  if (detectedZoning || state.protocols.includes("fc") || state.protocols.includes("fcoe") || state.protocols.includes("nvme_fc")) {
    state.network.zoningEnable = true;
    state.parsedFields.zoningEnable = true;
  } else {
    state.network.zoningEnable = false;
  }

  if (parsedAny) {
    let parsedList = [];
    if (state.parsedFields.version) parsedList.push("Version");
    if (state.parsedFields.controller) parsedList.push("Controller");
    if (state.parsedFields.nodeCount) parsedList.push("Node Count");
    if (state.parsedFields.shelfType) parsedList.push("Shelf Type");
    if (state.parsedFields.diskSize) parsedList.push("Disk Size");
    if (state.parsedFields.diskCount) parsedList.push("Disk Count");
    if (state.parsedFields.mgmtIp) parsedList.push("Mgmt IP");
    if (state.parsedFields.svmName) parsedList.push("SVMs");
    if (state.parsedFields.aggrName) parsedList.push("Aggregates");
    if (state.parsedFields.volName) parsedList.push("Volumes");
    if (lunsParsed) parsedList.push("LUNs");
    if (state.parsedFields.initiators) parsedList.push("Host Mappings");
    if (state.parsedFields.switchBrand) parsedList.push("Switch Brand");
    if (state.parsedFields.vlanId) parsedList.push("VLAN ID");

    updateParserBadge("success", `Successfully Ingested: ${parsedList.join(", ")}`);
  } else {
    updateParserBadge("pending", "No values matched. Standard CLI outputs expected.");
  }

  // Refresh wizard UI components
  setPlatform(state.platform);
  syncUIWithState();
  syncVariableMonitorUI();
  recalculateCapacity();
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
}

function resetParsedFieldsTracker(isDefault = false) {
  for (let key in state.parsedFields) {
    state.parsedFields[key] = isDefault;
  }
  syncVariableMonitorUI();
}

function updateParserBadge(type, message) {
  const badgeEl = document.getElementById("parserBadge");
  if (!badgeEl) return;
  badgeEl.className = "parser-badge " + type;
  if (type === "success") {
    badgeEl.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px;"></i> ${message}`;
  } else if (type === "pending") {
    badgeEl.innerHTML = `<i data-lucide="alert-circle" style="width:14px;height:14px;"></i> ${message}`;
  } else if (type === "loading") {
    badgeEl.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width:14px;height:14px;"></i> ${message}`;
  } else if (type === "error") {
    badgeEl.innerHTML = `<i data-lucide="x-circle" style="width:14px;height:14px;"></i> ${message}`;
  }
  safeCreateIcons();
}

function syncVariableMonitorUI() {
  const fields = ["mgmtIp", "svmName", "aggrName", "volName", "initiators"];
  fields.forEach(f => {
    const isParsed = state.parsedFields[f];
    const badge = document.getElementById(`status_${f}`);
    const valSpan = document.getElementById(`val_${f}`);
    if (!badge || !valSpan) return;
    
    if (isParsed) {
      badge.className = "var-status-badge parsed";
      badge.innerText = "parsed";
    } else {
      badge.className = "var-status-badge default";
      badge.innerText = "default";
    }

    if (f === "mgmtIp") valSpan.innerText = state.network.mgmtIp;
    if (f === "svmName") valSpan.innerText = state.svms.map(s => s.name).join(", ");
    if (f === "aggrName") valSpan.innerText = state.volumes.map(v => v.aggregate).join(", ");
    if (f === "volName") valSpan.innerText = state.volumes.map(v => v.name).join(", ");
    if (f === "initiators") {
      let activeVal = "";
      if (state.protocol === "iscsi") activeVal = state.protocolData.iscsi.initiatorIqn;
      else if (state.protocol === "fc") activeVal = state.protocolData.fc.initiatorWwpn;
      else if (state.protocol === "fcoe") activeVal = state.protocolData.fcoe.initiatorWwpn;
      else if (state.protocol.startsWith("nvme")) {
        activeVal = state.protocol.includes("tcp") ? state.protocolData.nvme_tcp.hostNqn : state.protocolData.nvme_fc.hostNqn;
      } else {
        activeVal = "N/A (NFS/SMB/S3)";
      }
      valSpan.innerText = activeVal;
    }
  });
}

async function downloadSourceFiles() {
  if (window.location.protocol === 'file:') {
    alert("Downloading the source code repository zip is not supported when running the offline single-file app via 'file://'.\n\nPlease download the codebase directly from the GitHub repository: https://github.com/ebeauzec/netapp-configurator");
    return;
  }
  const files = [
    'index.html',
    'style.css',
    'app.js',
    'asup_examples.js',
    'sevenzip_js.js',
    'sevenzip_wasm.wasm',
    'bundle_offline.py',
    'README.md',
    '.gitignore',
    'build_app.sh',
    'main.swift',
    'Info.plist',
    'NetAppConfigurator.bat'
  ];
  
  const btn = document.getElementById("btnDownloadRepo");
  if (!btn) return;
  
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Downloading...';
  if (window.lucide) window.lucide.createIcons();
  
  try {
    const zip = new JSZip();
    const folder = zip.folder("netapp-configurator");
    
    await Promise.all(files.map(async (filename) => {
      try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const blob = await response.blob();
        folder.file(filename, blob);
      } catch (err) {
        console.error(`Skipping ${filename} due to download error:`, err);
      }
    }));
    
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "netapp-configurator.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Error creating ZIP download:", err);
    alert("Error compiling ZIP archive: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    if (window.lucide) window.lucide.createIcons();
  }
}

// 6. EVENT LISTENERS
function setupEventListeners() {
  
  // Save & Load Config Buttons
  const btnSaveConfig = document.getElementById("btnSaveConfig");
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener("click", saveConfigurationState);
  }
  const btnLoadConfig = document.getElementById("btnLoadConfig");
  const configFileInput = document.getElementById("configFileInput");
  if (btnLoadConfig && configFileInput) {
    btnLoadConfig.addEventListener("click", () => configFileInput.click());
    configFileInput.addEventListener("change", importConfigurationFromFile);
  }
  const btnDownloadRepo = document.getElementById("btnDownloadRepo");
  if (btnDownloadRepo) {
    btnDownloadRepo.addEventListener("click", downloadSourceFiles);
  }

  // Navigation
  document.querySelectorAll(".nav-step").forEach(stepEl => {
    stepEl.addEventListener("click", () => {
      const step = stepEl.getAttribute("data-step");
      showStep(step);
    });
  });

  document.getElementById("btnPrev").addEventListener("click", prevStep);
  document.getElementById("btnNext").addEventListener("click", nextStep);


  // Platform Setup
  document.getElementById("modeGreenfield").addEventListener("click", () => setDeploymentMode("greenfield"));
  document.getElementById("platformOntap").addEventListener("click", () => setPlatform("ontap"));
  document.getElementById("platformStoragegrid").addEventListener("click", () => setPlatform("storagegrid"));
  document.getElementById("platformVersion").addEventListener("change", (e) => {
    state.version = e.target.value;
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("ontapPlatform").addEventListener("change", (e) => {
    state.ontapPlatform = e.target.value;
    updateSizingDropdownOptions();
    updateProtocolFormsVisibility();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });

  // Scenario template selector
  document.getElementById("deploymentScenario").addEventListener("change", (e) => {
    applyScenarioTemplate(e.target.value);
  });

  // AutoSupport Mock Data Loaders
  document.getElementById("loadAsupNfsIscsi").addEventListener("click", () => loadAsupText(ASUP_EXAMPLES.nfs_iscsi.content));
  document.getElementById("loadAsupFc").addEventListener("click", () => loadAsupText(ASUP_EXAMPLES.fc_san.content));
  document.getElementById("loadAsupNvme").addEventListener("click", () => loadAsupText(ASUP_EXAMPLES.nvme_s3.content));
  document.getElementById("asupTextInput").addEventListener("input", (e) => parseAutoSupportText(e.target.value));

  // AutoSupport Drag & Drop Uploader (using the modeExisting option card)
  const dropzone = document.getElementById("modeExisting");
  const fileInput = document.getElementById("asupFileInput");

  // Window-wide Drag & Drop Handlers for seamless uploader integration
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dropzone) {
      dropzone.classList.add("dragover");
    }
  }, false);

  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dropzone) {
      dropzone.classList.add("dragover");
    }
  }, false);

  window.addEventListener("dragleave", (e) => {
    // Only remove highlight if we drag completely out of the browser window
    if (e.target === document.documentElement || e.target === document.body || !e.relatedTarget) {
      if (dropzone) {
        dropzone.classList.remove("dragover");
      }
    }
  }, false);

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dropzone) {
      dropzone.classList.remove("dragover");
    }
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setDeploymentMode("existing");
      handleAsupFiles(files);
    }
  }, false);

  if (dropzone && fileInput) {
    // Prevent event bubbling on file input click
    fileInput.addEventListener("click", (e) => e.stopPropagation());

    // Click triggers mode switch and file picker
    dropzone.addEventListener("click", (e) => {
      setDeploymentMode("existing");
      fileInput.click();
    });

    // File input change handler
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        setDeploymentMode("existing");
        handleAsupFiles(e.target.files);
      }
    });
  }

  // Dynamic SVM / Volume Buttons
  document.getElementById("btnAddSvm").addEventListener("click", addSvmRow);
  document.getElementById("btnAddVolume").addEventListener("click", addVolumeRow);

  // Workload Settings
  document.getElementById("workloadHypervisor").addEventListener("change", (e) => {
    state.workload.hypervisor = e.target.value;
    
    // Dynamic cards visibility
    const hvCard = document.getElementById("hypervisorSettingsCard");
    const esxiFields = document.getElementById("hypervisorFields_esxi");
    const hypervFields = document.getElementById("hypervisorFields_hyperv");
    const kvmFields = document.getElementById("hypervisorFields_kvm");

    if (state.workload.hypervisor === "none") {
      hvCard.style.display = "none";
    } else {
      hvCard.style.display = "block";
      esxiFields.style.display = state.workload.hypervisor === "esxi" ? "block" : "none";
      hypervFields.style.display = state.workload.hypervisor === "hyperv" ? "block" : "none";
      kvmFields.style.display = state.workload.hypervisor === "kvm" ? "block" : "none";
    }

    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });

  document.getElementById("workloadDb").addEventListener("change", (e) => {
    state.workload.db = e.target.value;
    const dbAutoLayoutGroup = document.getElementById("dbAutoLayoutGroup");
    const dbLayoutDesc = document.getElementById("dbLayoutDesc");
    
    const dbCard = document.getElementById("dbSettingsCard");
    const oracleFields = document.getElementById("dbFields_oracle");
    const mssqlFields = document.getElementById("dbFields_mssql");
    const postgresFields = document.getElementById("dbFields_postgres");

    if (state.workload.db === "none") {
      dbAutoLayoutGroup.style.display = "none";
      dbCard.style.display = "none";
    } else {
      dbAutoLayoutGroup.style.display = "block";
      dbCard.style.display = "block";
      oracleFields.style.display = state.workload.db === "oracle" ? "block" : "none";
      mssqlFields.style.display = state.workload.db === "mssql" ? "block" : "none";
      postgresFields.style.display = state.workload.db === "postgres" ? "block" : "none";

      if (state.workload.db === "oracle") {
        dbLayoutDesc.innerText = "Oracle best practices layout: Automatically add dedicated volumes for Data Files (ASM), Redo Logs, and Archivelog replication target directories.";
      } else if (state.workload.db === "mssql") {
        dbLayoutDesc.innerText = "MS SQL Server layout: Automatically add dedicated volumes for primary MDF data files, LDF database transaction logs, and TempDB instances.";
      } else if (state.workload.db === "postgres") {
        dbLayoutDesc.innerText = "PostgreSQL layout: Automatically create storage arrays separating postgres data clusters and WAL write-ahead log volumes.";
      }
    }
    
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });

  document.getElementById("btnApplyDbLayout").addEventListener("click", applyWorkloadStorageLayout);

  // Bind dynamic inputs to state paths
  const workloadInputs = [
    { id: "esxiHosts", path: "workload.esxi.hosts" },
    { id: "esxiMultipath", path: "workload.esxi.multipathPolicy" },
    { id: "esxiNfsVersion", path: "workload.esxi.nfsVersion" },
    { id: "esxiVaai", path: "workload.esxi.vaaiEnabled", isBool: true },
    { id: "hypervHosts", path: "workload.hyperv.hosts" },
    { id: "hypervIscsiTimeout", path: "workload.hyperv.iscsiTimeout", isNum: true },
    { id: "hypervMpio", path: "workload.hyperv.mpioEnabled", isBool: true },
    { id: "hypervCsv", path: "workload.hyperv.csvEnabled", isBool: true },
    { id: "kvmHosts", path: "workload.kvm.hosts" },
    { id: "kvmMultipath", path: "workload.kvm.multipathEnabled", isBool: true },
    { id: "oracleAsmGroups", path: "workload.oracle.asmDiskGroups" },
    { id: "oracleSectorSize", path: "workload.oracle.sectorSize" },
    { id: "oracleGridUser", path: "workload.oracle.gridUser" },
    { id: "oracleDbUser", path: "workload.oracle.oracleUser" },
    { id: "sqlAllocUnit", path: "workload.mssql.allocationUnitSize" },
    { id: "sqlCollation", path: "workload.mssql.collation" },
    { id: "sqlAlwaysOn", path: "workload.mssql.alwaysOnEnabled", isBool: true },
    { id: "pgWalSize", path: "workload.postgres.walSegmentSize" },
    { id: "pgSharedBuffers", path: "workload.postgres.sharedBuffers" }
  ];
  setupInputsMapping(workloadInputs);

  // StorageGRID Tenants & Buckets add buttons
  document.getElementById("btnAddSgTenant").addEventListener("click", () => {
    const nextId = state.sgTenants.length + 1;
    state.sgTenants.push({
      id: nextId,
      name: `Tenant-${nextId}`,
      quota: 500,
      sites: 1,
      ilmPolicy: "2_copies",
      protocol: "s3",
      allowPlatformServices: true
    });
    renderSgTenantTable();
    updateCodePreview();
    validateForm();
  });

  document.getElementById("btnAddSgBucket").addEventListener("click", () => {
    const nextId = state.sgBuckets.length + 1;
    const defaultTenant = state.sgTenants[0] ? state.sgTenants[0].name : "Production-Tenant";
    state.sgBuckets.push({
      id: nextId,
      name: `bucket-s3-${nextId}`,
      tenantName: defaultTenant,
      region: "us-east-1",
      versioning: true,
      objectLock: false,
      retentionDays: 30,
      eventNotifications: false,
      cloudMirror: false,
      searchIntegration: false,
      bucketBranches: false
    });
    renderSgBucketTable();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });

  // FabricPool Settings
  document.getElementById("ontapFabricPoolEnabled").addEventListener("change", (e) => {
    state.ontapFabricPool.enabled = e.target.checked;
    document.getElementById("ontapFabricPoolFields").style.display = e.target.checked ? "block" : "none";
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });

  const fpInputs = [
    { id: "fpSgEndpoint", path: "ontapFabricPool.endpoint" },
    { id: "fpSgPort", path: "ontapFabricPool.port", isNum: true },
    { id: "fpSgAccessKey", path: "ontapFabricPool.accessKey" },
    { id: "fpSgSecretKey", path: "ontapFabricPool.secretKey" },
    { id: "fpSgBucket", path: "ontapFabricPool.bucket" },
    { id: "fpProvider", path: "ontapFabricPool.providerType" },
    { id: "fpCaCertName", path: "ontapFabricPool.caCertName" },
    { id: "fpCaCertPem", path: "ontapFabricPool.caCertPem" }
  ];
  setupInputsMapping(fpInputs);

  document.getElementById("fpSgSsl").addEventListener("change", (e) => {
    state.ontapFabricPool.sslEnabled = e.target.value === "true";
    const pemGroup = document.getElementById("fpCaCertPemGroup");
    if (pemGroup) {
      pemGroup.style.display = state.ontapFabricPool.sslEnabled ? "block" : "none";
    }
    updateCodePreview();
    validateForm();
  });

  // StorageGRID HA & Load Balancer Settings
  const sgHaInputs = [
    { id: "sgHaGroupName", path: "sgIntegrations.haGroupName" },
    { id: "sgHaVip", path: "sgIntegrations.haVip" },
    { id: "sgHaMembers", path: "sgIntegrations.haMembers" },
    { id: "sgLbPort", path: "sgIntegrations.lbPort", isNum: true },
    { id: "sgLbEndpointName", path: "sgIntegrations.lbEndpointName" }
  ];
  setupInputsMapping(sgHaInputs);

  document.getElementById("sgLbProtocol").addEventListener("change", (e) => {
    state.sgIntegrations.lbProtocol = e.target.value;
    updateCodePreview();
  });

  // Protocol Grid Cards
  document.querySelectorAll("#protocolsSelectGrid .protocol-card").forEach(card => {
    card.addEventListener("click", () => {
      if (card.classList.contains("disabled")) return;
      const proto = card.getAttribute("data-protocol");
      toggleProtocol(proto);
    });
  });

  // Protocol input bindings mapping
  const protocolInputsMapping = [
    { id: "nfsExportPolicy", path: "protocolData.nfs.exportPolicy" },
    { id: "nfsClientMatch", path: "protocolData.nfs.clientMatch" },
    { id: "nfsAccessLevel", path: "protocolData.nfs.accessLevel" },
    { id: "smbShareName", path: "protocolData.smb.shareName" },
    { id: "smbAdDomain", path: "protocolData.smb.adDomain" },
    { id: "smbWorkgroup", path: "protocolData.smb.workgroup" },
    { id: "smbPermissions", path: "protocolData.smb.permissions" },
    { id: "iscsiTargetIqn", path: "protocolData.iscsi.targetIqn" },
    { id: "iscsiInitiatorIqn", path: "protocolData.iscsi.initiatorIqn" },
    { id: "iscsiChapEnable", path: "protocolData.iscsi.chapEnable", isBool: true },
    { id: "iscsiChapUser", path: "protocolData.iscsi.chapUser" },
    { id: "iscsiChapPassword", path: "protocolData.iscsi.chapPassword" },
    { id: "fcTargetWwpn", path: "protocolData.fc.targetWwpn" },
    { id: "fcInitiatorWwpn", path: "protocolData.fc.initiatorWwpn" },
    { id: "fcIgroupName", path: "protocolData.fc.igroupName" },
    { id: "fcoeTargetWwpn", path: "protocolData.fcoe.targetWwpn" },
    { id: "fcoeInitiatorWwpn", path: "protocolData.fcoe.initiatorWwpn" },
    { id: "fcoeIgroupName", path: "protocolData.fcoe.igroupName" },
    { id: "fcoeVlanId", path: "protocolData.fcoe.vlanId", isNum: true },
    { id: "nvmeTcpTargetNqn", path: "protocolData.nvme_tcp.targetNqn" },
    { id: "nvmeTcpHostNqn", path: "protocolData.nvme_tcp.hostNqn" },
    { id: "nvmeTcpPort", path: "protocolData.nvme_tcp.port", isNum: true },
    { id: "nvmeTcpSubsystem", path: "protocolData.nvme_tcp.subsystem" },
    { id: "nvmeFcTargetNqn", path: "protocolData.nvme_fc.targetNqn" },
    { id: "nvmeFcHostNqn", path: "protocolData.nvme_fc.hostNqn" },
    { id: "nvmeFcSubsystem", path: "protocolData.nvme_fc.subsystem" },
    { id: "ontapS3Bucket", path: "protocolData.ontap_s3.bucket" },
    { id: "ontapS3AccessKey", path: "protocolData.ontap_s3.accessKey" },
    { id: "ontapS3SecretKey", path: "protocolData.ontap_s3.secretKey" },
    { id: "ontapS3Ssl", path: "protocolData.ontap_s3.ssl", isBool: true }
  ];
  setupInputsMapping(protocolInputsMapping);

  document.getElementById("iscsiChapEnable").addEventListener("change", (e) => {
    document.getElementById("iscsiChapCredentials").style.display = e.target.checked ? "grid" : "none";
  });

  // Switch Setup Cards
  document.querySelectorAll("#stepPanel7 .options-grid .option-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll("#stepPanel7 .options-grid .option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.network.switchBrand = card.getAttribute("data-switch");
      
      const zoningGroup = document.getElementById("fabricSwitchGroup");
      if (state.network.switchBrand === "cisco" || state.network.switchBrand === "brocade") {
        zoningGroup.style.display = "block";
      } else {
        zoningGroup.style.display = "none";
      }
      
      updateSwitchVersionOptions();
      updateCodePreview();
      validateForm();
    });
  });

  const networkInputs = [
    { id: "switchVersion", path: "network.switchVersion" },
    { id: "switchPortSpeed", path: "network.portSpeed" },
    { id: "switchMtu", path: "network.mtu" },
    { id: "switchVlanId", path: "network.vlanId", isNum: true },
    { id: "switchMgmtIp", path: "network.mgmtIp" },
    { id: "switchZoningEnable", path: "network.zoningEnable", isBool: true },
    { id: "customSwitchAName", path: "customSwitchNames.switchA" },
    { id: "customSwitchBName", path: "customSwitchNames.switchB" }
  ];
  setupInputsMapping(networkInputs);

  // Trident Inputs
  document.getElementById("tridentIntegration").addEventListener("change", (e) => {
    state.trident.enabled = e.target.checked;
    document.getElementById("tridentFieldsContainer").style.display = e.target.checked ? "block" : "none";
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });

  const tridentInputs = [
    { id: "tridentK8sVersion", path: "trident.k8sVersion" },
    { id: "tridentDriverVersion", path: "trident.driverVersion" },
    { id: "tridentScReclaimPolicy", path: "trident.reclaimPolicy" },
    { id: "tridentScFsType", path: "trident.fsType" },
    { id: "tridentBackendName", path: "trident.backendName" }
  ];
  setupInputsMapping(tridentInputs);

  // StorageGRID integrations inputs mapping
  const sgIntegrationInputs = [
    { id: "sgIdentityFederation", path: "sgIntegrations.identityFederation" },
    { id: "sgKmsProvider", path: "sgIntegrations.kmsProvider" },
    { id: "sgIlmPolicy", path: "sgIntegrations.ilmPolicy" },
    { id: "sgEventNotifications", path: "sgIntegrations.eventNotifications", isBool: true },
    { id: "sgCloudMirror", path: "sgIntegrations.cloudMirror", isBool: true },
    { id: "sgSearchIntegration", path: "sgIntegrations.searchIntegration", isBool: true },
    { id: "sgTlsCompliance", path: "sgIntegrations.tlsCompliance" },
    { id: "sgS3Caching", path: "sgIntegrations.s3Caching", isBool: true },
    { id: "sgAssumeRole", path: "sgIntegrations.assumeRole", isBool: true }
  ];
  setupInputsMapping(sgIntegrationInputs);

  document.getElementById("sgIlmPolicy").addEventListener("change", () => {
    recalculateCapacity();
  });

  // Preview Tabs
  document.getElementById("tabCode").addEventListener("click", () => selectPreviewTab("code"));
  document.getElementById("tabSwitch").addEventListener("click", () => selectPreviewTab("switch"));
  document.getElementById("tabAnsible").addEventListener("click", () => selectPreviewTab("ansible"));
  document.getElementById("tabTrident").addEventListener("click", () => selectPreviewTab("trident"));
  document.getElementById("tabGuide").addEventListener("click", () => selectPreviewTab("guide"));
  document.getElementById("tabVariables").addEventListener("click", () => selectPreviewTab("variables"));
  document.getElementById("tabValidation").addEventListener("click", () => selectPreviewTab("validation"));

  const tabProposal = document.getElementById("tabProposal");
  if (tabProposal) {
    tabProposal.addEventListener("click", () => selectPreviewTab("proposal"));
  }

  const btnViewFullProposal = document.getElementById("btnViewFullProposal");
  if (btnViewFullProposal) {
    btnViewFullProposal.addEventListener("click", () => {
      selectPreviewTab("proposal");
      const container = document.getElementById("step8PreviewContainer");
      if (container) {
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  document.getElementById("btnCopyPreviewCode").addEventListener("click", copyPreviewCode);
  document.getElementById("btnDownloadPreviewFile").addEventListener("click", downloadPreviewFile);
  document.getElementById("btnReset").addEventListener("click", resetToDefaults);
  document.getElementById("btnDownloadBundle").addEventListener("click", downloadConfigurationBundle);

  // Bind Sizing Inputs [NEW]
  const sizingInputs = [
    { id: "sizingController", path: "sizing.controller" },
    { id: "sizingNodeCount", path: "sizing.nodeCount", isNum: true },
    { id: "sizingShelfType", path: "sizing.shelfType" },
    { id: "sizingDiskCount", path: "sizing.diskCount", isNum: true },
    { id: "sizingDiskSize", path: "sizing.diskSize" },
    { id: "sizingRaidType", path: "sizing.raidType" },
    { id: "sizingRaidGroupSize", path: "sizing.raidGroupSize", isNum: true },
    { id: "sizingSpareDisks", path: "sizing.spareDisks", isNum: true },
    { id: "sizingAggrName", path: "sizing.aggrNamePrefix" },
    { id: "clusterSwitchModel", path: "sizing.clusterSwitchModel" }
  ];
  setupInputsMapping(sizingInputs);

  // Custom Sizing Change Triggers
  document.getElementById("sizingShelfType").addEventListener("change", () => {
    updateDiskSizeOptions();
    recalculateCapacity();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingController").addEventListener("change", () => {
    recalculateCapacity();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingDiskCount").addEventListener("change", () => {
    recalculateCapacity();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingNodeCount").addEventListener("change", (e) => {
    if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
      const val = parseInt(e.target.value) || 4;
      let mccScale = "4";
      if (val <= 2) mccScale = "2";
      else if (val <= 4) mccScale = "4";
      else mccScale = "8";
      
      state.metrocluster.scale = mccScale;
      const scaleEl = document.getElementById("metroclusterScale");
      if (scaleEl) scaleEl.value = mccScale;
      
      state.sizing.nodeCount = parseInt(mccScale);
      e.target.value = mccScale;
    }
    recalculateCapacity();
    renderNodeNameInputs();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingDiskSize").addEventListener("change", () => {
    recalculateCapacity();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingRaidType").addEventListener("change", () => {
    recalculateCapacity();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingRaidGroupSize").addEventListener("input", () => {
    recalculateCapacity();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingSpareDisks").addEventListener("input", () => {
    recalculateCapacity();
    updateCablingPlanner();
    updateSummaryPanel();
    updateCodePreview();
    validateForm();
  });
  document.getElementById("sizingAggrName").addEventListener("input", () => {
    // Sync aggregate name to first volume's aggregate
    if (state.volumes[0]) {
      state.volumes[0].aggregate = document.getElementById("sizingAggrName").value;
      renderVolumeTable();
    }
    updateCodePreview();
  });

  // Cabling Switchless/Switched toggle
  document.getElementById("cablingSwitched").addEventListener("click", () => {
    document.getElementById("cablingSwitched").classList.add("selected");
    document.getElementById("cablingDirect").classList.remove("selected");
    state.sizing.clusterCabling = "switched";
    document.getElementById("clusterSwitchModelGroup").style.display = "block";
    updateCablingPlanner();
    updateCodePreview();
  });
  document.getElementById("cablingDirect").addEventListener("click", () => {
    document.getElementById("cablingDirect").classList.add("selected");
    document.getElementById("cablingSwitched").classList.remove("selected");
    state.sizing.clusterCabling = "direct";
    document.getElementById("clusterSwitchModelGroup").style.display = "none";
    updateCablingPlanner();
    updateCodePreview();
  });
  document.getElementById("clusterSwitchModel").addEventListener("change", () => {
    updateCablingPlanner();
    updateCodePreview();
  });

  // Bind QoS Inputs [NEW]
  const qosInputs = [
    { id: "qosPolicyType", path: "qos.policyType" },
    { id: "qosExpectedIops", path: "qos.expectedIops", isNum: true },
    { id: "qosPeakIops", path: "qos.peakIops", isNum: true },
    { id: "qosPeakThroughput", path: "qos.peakThroughput", isNum: true },
    { id: "qosAllocatedIops", path: "qos.allocatedIops", isNum: true },
    { id: "qosPeakIopsPerTb", path: "qos.peakIopsPerTb", isNum: true },
    { id: "qosAbsoluteMinIops", path: "qos.absoluteMinIops", isNum: true }
  ];
  setupInputsMapping(qosInputs);

  document.getElementById("qosPolicyType").addEventListener("change", (e) => {
    updateQosFieldsVisibility(e.target.value);
    updateCodePreview();
    validateForm();
  });

  // Bind MetroCluster Inputs
  const metroclusterInputs = [
    { id: "metroclusterEnabled", path: "metrocluster.enabled", isBool: true },
    { id: "metroclusterType", path: "metrocluster.type" },
    { id: "metroclusterScale", path: "metrocluster.scale" },
    { id: "metroclusterDistance", path: "metrocluster.distance", isNum: true },
    { id: "metroclusterLatency", path: "metrocluster.latency", isNum: true },
    { id: "metroclusterMediator", path: "metrocluster.mediator" }
  ];
  setupInputsMapping(metroclusterInputs);

  // MetroCluster Custom Event Listeners
  const metroclusterCheckbox = document.getElementById("metroclusterEnabled");
  if (metroclusterCheckbox) {
    metroclusterCheckbox.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      const configGroup = document.getElementById("metroclusterConfigGroup");
      if (configGroup) configGroup.style.display = enabled ? "block" : "none";
      
      if (enabled) {
        // Automatically synchronize the node count with MetroCluster scale
        const scaleVal = document.getElementById("metroclusterScale")?.value || "4";
        const nodeCountEl = document.getElementById("sizingNodeCount");
        if (nodeCountEl) {
          nodeCountEl.value = scaleVal;
          state.sizing.nodeCount = parseInt(scaleVal) || 4;
        }
      }
      recalculateCapacity();
      renderNodeNameInputs();
      updateCablingPlanner();
      updateSummaryPanel();
      updateCodePreview();
      validateForm();
    });
  }

  const scaleEl = document.getElementById("metroclusterScale");
  if (scaleEl) {
    scaleEl.addEventListener("change", (e) => {
      if (state.metrocluster.enabled) {
        const scaleVal = e.target.value;
        const nodeCountEl = document.getElementById("sizingNodeCount");
        if (nodeCountEl) {
          nodeCountEl.value = scaleVal;
          state.sizing.nodeCount = parseInt(scaleVal) || 4;
        }
      }
      recalculateCapacity();
      renderNodeNameInputs();
      updateCablingPlanner();
      updateSummaryPanel();
      updateCodePreview();
      validateForm();
    });
  }

  ["metroclusterType", "metroclusterDistance", "metroclusterLatency", "metroclusterMediator"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        recalculateCapacity();
        updateCablingPlanner();
        updateSummaryPanel();
        updateCodePreview();
        validateForm();
      });
      el.addEventListener("input", () => {
        recalculateCapacity();
        updateCablingPlanner();
        updateSummaryPanel();
        updateCodePreview();
        validateForm();
      });
    }
  });
}


// SIZING & CABLING ASSISTANT HELPER FUNCTIONS [NEW]
function parseDiskSizeToGb(sizeStr) {
  if (!sizeStr) return 0;
  if (sizeStr.endsWith("TB")) {
    return parseFloat(sizeStr.replace("TB", "")) * 1000;
  } else if (sizeStr.endsWith("GB")) {
    return parseFloat(sizeStr.replace("GB", ""));
  }
  return parseFloat(sizeStr) || 0;
}

function getEfficiencyRatio() {
  if (state.workload.db !== "none") {
    return 1.5;
  }
  if (state.workload.hypervisor !== "none") {
    return 3.0;
  }
  if (state.trident.enabled) {
    return 2.0;
  }
  return 1.2;
}

function formatCapacity(gb) {
  if (gb >= 1000) {
    return `${(gb / 1000).toFixed(2)} TB`;
  }
  return `${Math.round(gb)} GB`;
}

function recalculateCapacity() {
  const isSg = state.platform === "storagegrid";
  
  // Set visibility of Snapshot in capacity legend
  const legendSnapshot = document.getElementById("legendSnapshot");
  if (legendSnapshot) {
    legendSnapshot.style.display = isSg ? "none" : "";
  }
  
  // Update WAFL / Metadata label in legend
  const lblWafl = document.getElementById("lblWafl");
  if (lblWafl) {
    lblWafl.innerText = isSg ? "Metadata & OS (15%)" : "WAFL (10%)";
  }

  if (isSg) {
    const diskSizeGb = parseDiskSizeToGb(state.sizing.diskSize);
    const totalNodes = state.sizing.nodeCount;
    const ctrl = state.sizing.controller;
    
    let isComputeOnly = ["SG100", "SG110", "SG1000", "SG1100"].includes(ctrl);
    let isVirtual = ["VMware_VM", "Software_Node"].includes(ctrl);
    
    let rawGb = 0;
    let parityGb = 0;
    let spareGb = 0;
    let metadataGb = 0;
    let usableGb = 0;
    let logicalGb = 0;
    let multiplier = 0.5;
    let ratioText = "0.5:1";
    
    const ilm = state.sgIntegrations.ilmPolicy;
    if (ilm === "2_copies") {
      multiplier = 0.5;
      ratioText = "0.5:1 (2-Copy)";
    } else if (ilm === "3_copies") {
      multiplier = 0.3333;
      ratioText = "0.33:1 (3-Copy)";
    } else if (ilm === "ec_2_1") {
      multiplier = 2 / 3;
      ratioText = "0.67:1 (EC 2+1)";
    } else if (ilm === "ec_4_2") {
      multiplier = 4 / 6;
      ratioText = "0.67:1 (EC 4+2)";
    } else if (ilm === "ec_6_3") {
      multiplier = 6 / 9;
      ratioText = "0.67:1 (EC 6+3)";
    }
    
    if (!isComputeOnly) {
      const diskCount = state.sizing.diskCount; // disks per node
      const totalDisks = diskCount * totalNodes;
      rawGb = totalDisks * diskSizeGb;
      
      if (isVirtual) {
        // Virtual/Software VMDK nodes: no appliance-level spares/parity
        parityGb = 0;
        spareGb = 0;
      } else {
        // Physical storage appliances allocate 2 parity and 2 spares per node
        const parityDisks = 2 * totalNodes;
        const spareDisks = 2 * totalNodes;
        parityGb = parityDisks * diskSizeGb;
        spareGb = spareDisks * diskSizeGb;
      }
      
      const storageAvailableGb = Math.max(0, rawGb - parityGb - spareGb);
      metadataGb = storageAvailableGb * 0.15;
      usableGb = Math.max(0, storageAvailableGb - metadataGb);
      logicalGb = usableGb * multiplier;
    }
    
    state.sizing.rawGb = rawGb;
    state.sizing.usableGb = usableGb;
    state.sizing.logicalGb = logicalGb;
    updateCapacityUI(rawGb, usableGb, 0, metadataGb, spareGb, parityGb, ratioText, logicalGb);
    return;
  }

  // ONTAP capacity logic
  const diskSizeGb = parseDiskSizeToGb(state.sizing.diskSize);
  const totalDisks = state.sizing.diskCount * (state.sizing.nodeCount / 2);
  const rawGb = totalDisks * diskSizeGb;

  const raidType = state.sizing.raidType;
  const raidGroupSize = state.sizing.raidGroupSize;

  // Assuming symmetric storage across aggregates
  const disksPerAggr = totalDisks / 2;
  const numRaidGroups = Math.ceil(disksPerAggr / raidGroupSize);
  const parityDisksPerAggr = numRaidGroups * (raidType === "raid_dp" ? 2 : 3);
  const totalParityDisks = parityDisksPerAggr * 2;

  const totalSpareDisks = state.sizing.spareDisks * (state.sizing.nodeCount / 2) * 2;
  
  const dataDisks = Math.max(0, totalDisks - totalParityDisks - totalSpareDisks);
  const usableAggregateCapacity = dataDisks * diskSizeGb;

  const waflCapacity = usableAggregateCapacity * 0.10;
  const usableSpaceBeforeSnapshot = usableAggregateCapacity - waflCapacity;
  const snapshotCapacity = usableSpaceBeforeSnapshot * 0.05;
  const finalUsableSpace = Math.max(0, usableSpaceBeforeSnapshot - snapshotCapacity);

  const spareCapacityGb = totalSpareDisks * diskSizeGb;
  const parityCapacityGb = totalParityDisks * diskSizeGb;

  const efficiencyRatio = getEfficiencyRatio();
  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    // MetroCluster IP/FC uses SyncMirror to replicate all storage aggregates across sites.
    // This doubles the overall hardware requirements (disks, shelves, controllers).
    state.sizing.rawGb = rawGb * 2;
    state.sizing.usableGb = finalUsableSpace; // logical active usable capacity for client workloads
    state.sizing.logicalGb = finalUsableSpace * efficiencyRatio;
    
    // Update the UI capacity visualization with the global dual-site physical capacities
    updateCapacityUI(
      rawGb * 2,
      finalUsableSpace * 2,
      snapshotCapacity * 2,
      waflCapacity * 2,
      spareCapacityGb * 2,
      parityCapacityGb * 2,
      efficiencyRatio
    );
  } else {
    state.sizing.rawGb = rawGb;
    state.sizing.usableGb = finalUsableSpace;
    state.sizing.logicalGb = finalUsableSpace * efficiencyRatio;
    updateCapacityUI(rawGb, finalUsableSpace, snapshotCapacity, waflCapacity, spareCapacityGb, parityCapacityGb, efficiencyRatio);
  }
}

function updateSizingDropdownOptions() {
  const isSg = state.platform === "storagegrid";
  const controllerSelect = document.getElementById("sizingController");
  const shelfSelect = document.getElementById("sizingShelfType");
  const nodeCountSelect = document.getElementById("sizingNodeCount");
  
  if (!controllerSelect || !shelfSelect || !nodeCountSelect) return;
  
  // Re-populate controller dropdown
  const prevController = state.sizing.controller;
  controllerSelect.innerHTML = "";
  
  if (isSg) {
    const sgControllers = [
      { val: "SG6100", label: "SG6100 StorageGRID Storage Appliance (All-Flash/Compute)" },
      { val: "SG6160", label: "SG6160 StorageGRID Storage Appliance (All-Flash)" },
      { val: "SG6060", label: "SG6060 StorageGRID Storage Appliance (60-Bay)" },
      { val: "SG5800", label: "SG5800 StorageGRID Storage Appliance (Hybrid/Compute)" },
      { val: "SG5860", label: "SG5860 StorageGRID Storage Appliance (60-Bay)" },
      { val: "SG5812", label: "SG5812 StorageGRID Storage Appliance (12-Bay)" },
      { val: "SG1100", label: "SG1100 Grid Services Appliance (Compute Gateway)" },
      { val: "SG110", label: "SG110 Grid Services Appliance (Compute Gateway)" },
      { val: "SG1000", label: "SG1000 Grid Services Appliance (Compute Gateway)" },
      { val: "SG100", label: "SG100 Grid Services Appliance (Compute Gateway)" },
      { val: "VMware_VM", label: "Virtual Machine (VMware ESXi VM)" },
      { val: "Software_Node", label: "Software Node (Bare-Metal Linux)" }
    ];

    const sgVals = sgControllers.map(c => c.val);
    if (false && prevController && !sgVals.includes(prevController)) {
      sgControllers.push({ val: prevController, label: `${prevController} (Parsed from ASUP)` });
    }

    sgControllers.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.val;
      opt.innerText = c.label;
      controllerSelect.appendChild(opt);
    });
    
    if (!sgControllers.map(c => c.val).includes(prevController)) {
      state.sizing.controller = "SG5860";
    }
  } else {
    let ontapControllers = [];
    if (state.ontapPlatform === "asa") {
      ontapControllers = [
        { val: "ASA_A1K", label: "ASA A1K (High-End Enterprise SAN NVMe)" },
        { val: "ASA_A90", label: "ASA A90 (High-End SAN NVMe)" },
        { val: "ASA_A70", label: "ASA A70 (Mid-Range SAN NVMe)" },
        { val: "ASA_A50", label: "ASA A50 (Mid-Range SAN NVMe)" },
        { val: "ASA_A30", label: "ASA A30 (Entry SAN NVMe)" },
        { val: "ASA_A20", label: "ASA A20 (Entry SAN NVMe)" },
        { val: "ASA_C80", label: "ASA C80 (High-Capacity SAN NVMe)" },
        { val: "ASA_C60", label: "ASA C60 (High-Capacity SAN NVMe)" },
        { val: "ASA_C30", label: "ASA C30 (Entry Capacity SAN NVMe)" },
        { val: "ASA_A900", label: "ASA A900 (Enterprise SAN NVMe)" },
        { val: "ASA_A400", label: "ASA A400 (High-Performance SAN NVMe)" },
        { val: "ASA_A250", label: "ASA A250 (Mid-Range SAN NVMe)" },
        { val: "ASA_A150", label: "ASA A150 (Entry-Level SAN NVMe)" },
        { val: "ASA_C800", label: "ASA C800 (Capacity SAN NVMe)" },
        { val: "ASA_C400", label: "ASA C400 (Capacity SAN NVMe)" },
        { val: "ASA_C250", label: "ASA C250 (Capacity SAN NVMe)" }
      ];
    } else if (state.ontapPlatform === "aff") {
      ontapControllers = [
        { val: "A1K", label: "AFF A1K (High-End Enterprise Unified NVMe)" },
        { val: "A90", label: "AFF A90 (High-End Unified NVMe)" },
        { val: "A70", label: "AFF A70 (Mid-Range Unified NVMe)" },
        { val: "A50", label: "AFF A50 (Mid-Range Unified NVMe)" },
        { val: "A30", label: "AFF A30 (Entry Unified NVMe)" },
        { val: "A20", label: "AFF A20 (Entry Unified NVMe)" },
        { val: "C80", label: "AFF C80 (High-Capacity NVMe)" },
        { val: "C60", label: "AFF C60 (High-Capacity NVMe)" },
        { val: "C30", label: "AFF C30 (Entry Capacity NVMe)" },
        { val: "A900", label: "AFF A900 (Enterprise Unified NVMe)" },
        { val: "A400", label: "AFF A400 (High-Performance Unified NVMe)" },
        { val: "A250", label: "AFF A250 (Mid-Range Unified NVMe)" },
        { val: "A150", label: "AFF A150 (Entry-Level Unified NVMe)" },
        { val: "C800", label: "AFF C800 (Capacity NVMe)" },
        { val: "C400", label: "AFF C400 (Capacity NVMe)" },
        { val: "C250", label: "AFF C250 (Capacity NVMe)" }
      ];
    } else { // FAS / afx
      ontapControllers = [
        { val: "FAS70", label: "FAS70 (Next-Gen High-Capacity Hybrid)" },
        { val: "FAS9500", label: "FAS9500 (Enterprise Hybrid)" },
        { val: "FAS8700", label: "FAS8700 (High-Capacity Hybrid)" },
        { val: "FAS8300", label: "FAS8300 (Mid-Range Hybrid)" },
        { val: "FAS2820", label: "FAS2820 (Entry-Level Hybrid)" }
      ];
    }

    const ontapVals = ontapControllers.map(c => c.val);
    if (false && prevController && !ontapVals.includes(prevController)) {
      ontapControllers.push({ val: prevController, label: `${prevController} (Parsed from ASUP)` });
    }
    
    ontapControllers.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.val;
      opt.innerText = c.label;
      controllerSelect.appendChild(opt);
    });
    
    if (!ontapControllers.map(c => c.val).includes(prevController)) {
      state.sizing.controller = ontapControllers[0].val;
    }
  }
  controllerSelect.value = state.sizing.controller;

  // Re-populate Node Count select options
  const prevNodeCount = state.sizing.nodeCount;
  nodeCountSelect.innerHTML = "";
  if (isSg) {
    const sgNodeCounts = [1, 2, 3, 4, 6, 8, 9, 12, 16, 24];
    if (prevNodeCount && !sgNodeCounts.includes(prevNodeCount)) {
      sgNodeCounts.push(prevNodeCount);
      sgNodeCounts.sort((a, b) => a - b);
    }
    sgNodeCounts.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.innerText = `${n} Node${n > 1 ? 's' : ''}`;
      nodeCountSelect.appendChild(opt);
    });
    if (!sgNodeCounts.includes(prevNodeCount)) {
      state.sizing.nodeCount = 4;
    }
  } else {
    const ontapNodeCounts = [2, 4, 6, 8, 12];
    if (prevNodeCount && !ontapNodeCounts.includes(prevNodeCount)) {
      ontapNodeCounts.push(prevNodeCount);
      ontapNodeCounts.sort((a, b) => a - b);
    }
    ontapNodeCounts.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.innerText = `${n} Nodes (${n / 2} HA Pair${n / 2 > 1 ? 's' : ''})`;
      nodeCountSelect.appendChild(opt);
    });
    if (!ontapNodeCounts.includes(prevNodeCount)) {
      state.sizing.nodeCount = 2;
    }
  }
  nodeCountSelect.value = state.sizing.nodeCount;
  
  updateShelfOptions();
}

function updateShelfOptions() {
  const isSg = state.platform === "storagegrid";
  const shelfSelect = document.getElementById("sizingShelfType");
  if (!shelfSelect) return;
  
  const prevShelf = state.sizing.shelfType;
  shelfSelect.innerHTML = "";
  
  if (isSg) {
    const ctrl = state.sizing.controller;
    let shelves = [];
    if (ctrl === "SG100" || ctrl === "SG110" || ctrl === "SG1000" || ctrl === "SG1100") {
      shelves = [{ val: "none", label: "No disk shelves (Compute Only)" }];
    } else if (ctrl === "VMware_VM" || ctrl === "Software_Node") {
      shelves = [{ val: "VMDK", label: "Virtual Machine Disks (VMDK)" }];
    } else if (ctrl === "SG5712" || ctrl === "SG5812") {
      shelves = [
        { val: "built_in_12", label: "Built-in 12-bay" },
        { val: "expansion_12", label: "Expansion Shelf (12-bay)" }
      ];
    } else {
      shelves = [
        { val: "built_in_60", label: "Built-in 60-bay" },
        { val: "expansion_60", label: "Expansion Shelf (60-bay)" }
      ];
    }
    
    const shelfVals = shelves.map(s => s.val);
    if (false && prevShelf && !shelfVals.includes(prevShelf)) {
      shelves.push({ val: prevShelf, label: `${prevShelf} (Parsed from ASUP)` });
    }
    
    shelves.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.val;
      opt.innerText = s.label;
      shelfSelect.appendChild(opt);
    });
    
    if (!shelves.map(s => s.val).includes(prevShelf)) {
      state.sizing.shelfType = shelves[0].val;
    }
  } else {
    const shelves = [
      { val: "NS224", label: "NS224 (24-Bay 100Gb NVMe RoCE)" },
      { val: "DS224C", label: "DS224C (24-Bay 12Gb SAS SSD)" },
      { val: "DS212C", label: "DS212C (12-Bay 12Gb SAS LFF HDD)" }
    ];
    
    const shelfVals = shelves.map(s => s.val);
    if (false && prevShelf && !shelfVals.includes(prevShelf)) {
      shelves.push({ val: prevShelf, label: `${prevShelf} (Parsed from ASUP)` });
    }
    
    shelves.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.val;
      opt.innerText = s.label;
      shelfSelect.appendChild(opt);
    });
    if (!shelves.map(s => s.val).includes(prevShelf)) {
      state.sizing.shelfType = "NS224";
    }
  }
  
  shelfSelect.value = state.sizing.shelfType;
  updateDiskSizeOptions();
}

function updateDiskSizeOptions() {
  const isSg = state.platform === "storagegrid";
  const shelfType = state.sizing.shelfType;
  const select = document.getElementById("sizingDiskSize");
  if (!select) return;
  
  select.innerHTML = "";
  let sizes = [];
  let defaultSize = "3.8TB";
  
  if (isSg) {
    if (shelfType === "none") {
      sizes = ["0TB"];
      defaultSize = "0TB";
    } else if (shelfType === "VMDK") {
      sizes = ["100GB", "500GB", "1TB", "2TB", "3TB", "4TB", "5TB"];
      defaultSize = "1TB";
    } else if (shelfType === "built_in_12" || shelfType === "expansion_12" || shelfType === "built_in_60" || shelfType === "expansion_60") {
      sizes = ["4TB", "8TB", "12TB", "16TB", "18TB", "20TB", "22TB", "1.6TB SSD", "7.6TB SSD"];
      defaultSize = "16TB";
    }
  } else {
    if (shelfType === "NS224") {
      sizes = ["1.9TB", "3.8TB", "7.6TB", "15.3TB", "30.6TB"];
      defaultSize = "3.8TB";
    } else if (shelfType === "DS224C") {
      sizes = ["960GB", "1.9TB", "3.8TB", "7.6TB"];
      defaultSize = "1.9TB";
    } else {
      sizes = ["4TB", "8TB", "12TB", "16TB", "20TB"];
      defaultSize = "8TB";
    }
  }
  
  // Add parsed size if missing
  if (state.sizing.diskSize && !sizes.includes(state.sizing.diskSize)) {
    sizes.push(state.sizing.diskSize);
  }
  
  if (!sizes.includes(state.sizing.diskSize)) {
    state.sizing.diskSize = defaultSize;
  }
  
  sizes.forEach(sz => {
    const opt = document.createElement("option");
    opt.value = sz;
    opt.innerText = sz;
    select.appendChild(opt);
  });
  
  select.value = state.sizing.diskSize;
  updateDiskCountRange();
}

function updateDiskCountRange() {
  const isSg = state.platform === "storagegrid";
  const diskCountInput = document.getElementById("sizingDiskCount");
  const diskCountLabel = document.querySelector("label[for='sizingDiskCount']");
  if (!diskCountInput) return;

  const prevVal = parseInt(state.sizing.diskCount) || 0;
  diskCountInput.innerHTML = ""; // Clear existing options

  let options = [];
  let defaultVal = 24;

  if (isSg) {
    const ctrl = state.sizing.controller;
    const shelf = state.sizing.shelfType;
    if (diskCountLabel) diskCountLabel.innerHTML = 'Disks per Node <span class="required">*</span>';

    if (ctrl === "SG100" || ctrl === "SG110" || ctrl === "SG1000" || ctrl === "SG1100") {
      options = [0];
      defaultVal = 0;
      diskCountInput.disabled = true;
    } else if (ctrl === "VMware_VM" || ctrl === "Software_Node") {
      options = [1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
      defaultVal = 16;
      diskCountInput.disabled = false;
    } else {
      diskCountInput.disabled = false;
      if (shelf === "built_in_12") {
        options = [12];
        defaultVal = 12;
      } else if (shelf === "expansion_12") {
        options = [12, 24, 36];
        defaultVal = 24;
      } else if (shelf === "built_in_60") {
        options = [60];
        defaultVal = 60;
      } else if (shelf === "expansion_60") {
        options = [60, 120];
        defaultVal = 120;
      } else {
        options = [12];
        defaultVal = 12;
      }
    }
  } else {
    if (diskCountLabel) diskCountLabel.innerHTML = 'Disks per Node Pair <span class="required">*</span>';
    diskCountInput.disabled = false;
    const shelf = state.sizing.shelfType;
    if (shelf === "DS212C") {
      options = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144];
      defaultVal = 24;
    } else {
      options = [12, 24, 36, 48, 72, 96, 120, 144];
      defaultVal = 24;
    }
  }

  // Add parsed if missing
  if (prevVal && !options.includes(prevVal)) {
    options.push(prevVal);
    options.sort((a, b) => a - b);
  }

  // Populate select options
  options.forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.innerText = val === 0 ? "0 (Compute Only)" : `${val} Disks`;
    diskCountInput.appendChild(opt);
  });

  // Select appropriate value
  if (options.includes(prevVal)) {
    diskCountInput.value = prevVal;
  } else {
    diskCountInput.value = defaultVal;
  }
  state.sizing.diskCount = parseInt(diskCountInput.value) || 0;
}

function updateCapacityUI(raw, usable, snap, wafl, spare, parity, ratio, logicalOverride) {
  const total = raw || 1;
  const pUsable = (usable / total * 100).toFixed(1);
  const pSnap = (snap / total * 100).toFixed(1);
  const pWafl = (wafl / total * 100).toFixed(1);
  const pSpare = (spare / total * 100).toFixed(1);
  const pRaid = (parity / total * 100).toFixed(1);

  const capUsableBar = document.getElementById("capUsableBar");
  const capSnapshotBar = document.getElementById("capSnapshotBar");
  const capWaflBar = document.getElementById("capWaflBar");
  const capSpareBar = document.getElementById("capSpareBar");
  const capRaidBar = document.getElementById("capRaidBar");

  const isSg = state.platform === "storagegrid";

  if (capUsableBar) {
    capUsableBar.style.width = `${pUsable}%`;
    capUsableBar.innerText = pUsable >= 10 ? `Usable (${pUsable}%)` : "";
  }
  if (capSnapshotBar) {
    capSnapshotBar.style.width = `${pSnap}%`;
    capSnapshotBar.innerText = pSnap >= 10 ? `Snap` : "";
  }
  if (capWaflBar) {
    capWaflBar.style.width = `${pWafl}%`;
    capWaflBar.innerText = pWafl >= 10 ? (isSg ? "Metadata" : "WAFL") : "";
  }
  if (capSpareBar) {
    capSpareBar.style.width = `${pSpare}%`;
    capSpareBar.innerText = pSpare >= 10 ? `Spare` : "";
  }
  if (capRaidBar) {
    capRaidBar.style.width = `${pRaid}%`;
    capRaidBar.innerText = pRaid >= 10 ? `Parity` : "";
  }

  const valUsableGb = document.getElementById("valUsableGb");
  const valSnapshotGb = document.getElementById("valSnapshotGb");
  const valWaflGb = document.getElementById("valWaflGb");
  const valSpareGb = document.getElementById("valSpareGb");
  const valRaidGb = document.getElementById("valRaidGb");
  const valRawGb = document.getElementById("valRawGb");

  if (valUsableGb) valUsableGb.innerText = formatCapacity(usable);
  if (valSnapshotGb) valSnapshotGb.innerText = formatCapacity(snap);
  if (valWaflGb) valWaflGb.innerText = formatCapacity(wafl);
  if (valSpareGb) valSpareGb.innerText = formatCapacity(spare);
  if (valRaidGb) valRaidGb.innerText = formatCapacity(parity);
  if (valRawGb) valRawGb.innerText = formatCapacity(raw);

  const valEfficiencyRatio = document.getElementById("valEfficiencyRatio");
  const valLogicalGb = document.getElementById("valLogicalGb");

  if (valEfficiencyRatio) {
    if (typeof ratio === "string") {
      valEfficiencyRatio.innerText = ratio;
    } else {
      valEfficiencyRatio.innerText = `${ratio.toFixed(1)}:1`;
    }
  }

  if (valLogicalGb) {
    if (logicalOverride !== undefined) {
      valLogicalGb.innerText = formatCapacity(logicalOverride);
    } else {
      const logical = usable * ratio;
      valLogicalGb.innerText = formatCapacity(logical);
    }
  }
}

function getExpansionCardsAndPorts(model, shelfType, shelfCount) {
  const m = model.toUpperCase();
  const isNvme = shelfType === "NS224";
  const stackSize = isNvme ? 2 : 4;
  const totalStacks = Math.ceil(shelfCount / stackSize);
  const cardsNeeded = totalStacks - 1;

  const result = {
    cards: [],
    portPairs: []
  };

  const onboardPorts = getControllerPorts(model).storage;
  result.portPairs.push(onboardPorts);

  if (cardsNeeded <= 0) {
    return result;
  }

  // Define slot priorities per model
  let slotPriority = [1, 2, 3, 4];
  if (m.includes("A1K") || m.includes("ASA_A1K")) {
    slotPriority = [5, 7, 9, 11];
  } else if (m.includes("A90") || m.includes("C80") || m.includes("ASA_A90") || m.includes("ASA_C80")) {
    slotPriority = [1, 2];
  } else if (m.includes("A70") || m.includes("C60") || m.includes("ASA_A70") || m.includes("ASA_C60")) {
    slotPriority = [1, 2];
  } else if (m.includes("A50") || m.includes("C30") || m.includes("A30") || m.includes("ASA_A50") || m.includes("ASA_C30") || m.includes("ASA_A30")) {
    slotPriority = [1];
  } else if (m.includes("A20") || m.includes("ASA_A20")) {
    slotPriority = [1];
  } else if (m.includes("A900") || m.includes("C800") || m.includes("ASA_A900") || m.includes("ASA_C800")) {
    slotPriority = [4, 6, 8, 10];
  } else if (m.includes("A400") || m.includes("C400") || m.includes("ASA_A400") || m.includes("ASA_C400")) {
    slotPriority = [1, 2, 4, 5]; // slot 3 is smart I/O
  } else if (m.includes("A250") || m.includes("C250") || m.includes("A150") || m.includes("ASA_A250") || m.includes("ASA_C250") || m.includes("ASA_A150")) {
    slotPriority = [1]; // mezzanine slot
  } else if (m.includes("FAS70") || m.includes("FAS8700") || m.includes("FAS9500")) {
    slotPriority = [3, 4, 5, 6];
  } else if (m.includes("FAS2750")) {
    slotPriority = [1];
  }

  for (let c = 0; c < cardsNeeded; c++) {
    const slot = slotPriority[c] || (slotPriority[slotPriority.length - 1] + c);
    let cardModel = "";
    let ports = [];
    if (isNvme) {
      cardModel = "X1148A"; // 2-port 100GbE RoCE QSFP28
      ports = [`e${slot}a`, `e${slot}b`];
    } else {
      cardModel = "X1144A"; // 4-port 12Gb SAS HBA
      ports = [`${slot}a`, `${slot}b`]; // We only need 2 ports for a stack pair
    }

    result.cards.push({
      cardModel: cardModel,
      slot: slot,
      ports: ports
    });
    result.portPairs.push(ports);
  }

  return result;
}

function getControllerPorts(model) {
  const m = (model || "").toUpperCase();
  if (m.includes("A1K") || m.includes("A90") || m.includes("C80") || m.includes("ASA_A90") || m.includes("ASA_C80") || m.includes("A900") || m.includes("C800") || m.includes("ASA_A900") || m.includes("ASA_C800")) {
    return { cluster: ["e1a", "e1b"], storage: ["e2a", "e2b"], management: "e0M", data: ["e3a", "e3b"] };
  } else if (m.includes("A70") || m.includes("A50") || m.includes("C60") || m.includes("ASA_A70") || m.includes("ASA_A50") || m.includes("ASA_C60") || m.includes("A400") || m.includes("C400") || m.includes("ASA_A400") || m.includes("ASA_C400") || m.includes("FAS9500")) {
    return { cluster: ["e0a", "e0b"], storage: ["e0c", "e0d"], management: "e0M", data: ["e0e", "e0f"] };
  } else if (m.includes("FAS")) {
    return { cluster: ["e0a", "e0b"], storage: ["0a", "0b"], management: "e0M", data: ["e0c", "e0d"] };
  } else {
    // Default ports for entry-level models (A150, A250, C250, A30, A20, C30, ASA counterparts)
    return { cluster: ["e0a", "e0b"], storage: ["e0c", "e0d"], management: "e0M", data: ["e0e", "e0f"] };
  }
}

function generateCablingRows() {
  const isSg = state.platform === "storagegrid";
  const model = state.sizing.controller;
  const nodeCount = parseInt(state.sizing.nodeCount) || 2;
  const clusterCabling = state.sizing.clusterCabling;
  const switchModel = state.sizing.clusterSwitchModel;
  const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
  const ports = getControllerPorts(model);
  const proto = state.protocol;

  const switchAName = (state.customSwitchNames && state.customSwitchNames.switchA) || "Switch-A";
  const switchBName = (state.customSwitchNames && state.customSwitchNames.switchB) || "Switch-B";
  const getNodeName = (x) => state.customNodeNames[x - 1] || `Node ${x}`;
  
  const rows = [];
  const isNvme = state.sizing.shelfType === "NS224";
  const stackSize = isNvme ? 2 : 4;
  
  if (isSg) {
    for (let i = 1; i <= nodeCount; i++) {
      const nodeName = getNodeName(i);
      rows.push({ src: `${nodeName} (${model})`, srcPort: "ADM", dest: "Admin Network Switch", destPort: `Port ${i}`, type: "Admin Network Link" });
      rows.push({ src: `${nodeName} (${model})`, srcPort: "1", dest: `${switchAName} (Grid A)`, destPort: `Port ${i * 2 - 1}`, type: "Grid Fabric Link A (Active)" });
      rows.push({ src: `${nodeName} (${model})`, srcPort: "3", dest: `${switchBName} (Grid B)`, destPort: `Port ${i * 2}`, type: "Grid Fabric Link B (Standby/Active)" });
      
      const isCompute = ["SG100", "SG110", "SG1000", "SG1100"].includes(model);
      if (!isCompute) {
        rows.push({ src: `${nodeName} (${model})`, srcPort: "2", dest: `${switchAName} (Client A)`, destPort: `Port ${i * 2 - 1}`, type: "S3 Client Gateway A (Active)" });
        rows.push({ src: `${nodeName} (${model})`, srcPort: "4", dest: `${switchBName} (Client B)`, destPort: `Port ${i * 2}`, type: "S3 Client Gateway B (Standby/Active)" });
      }
    }
  } else {
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      const isIp = mcc.type === "ip";
      const mcSwitchA1 = isIp ? `${switchAName} 1 (Site A)` : `Brocade FC-${switchAName} 1 (Site A)`;
      const mcSwitchB1 = isIp ? `${switchBName} 1 (Site A)` : `Brocade FC-${switchBName} 1 (Site A)`;
      const mcSwitchA2 = isIp ? `${switchAName} 2 (Site B)` : `Brocade FC-${switchAName} 2 (Site B)`;
      const mcSwitchB2 = isIp ? `${switchBName} 2 (Site B)` : `Brocade FC-${switchBName} 2 (Site B)`;
      const mcLinkType = isIp ? "MetroCluster IP Replication" : "MetroCluster FC Replication";
      
      const halfNodes = nodeCount / 2; // 1, 2, or 4
      
      // 1. Cluster Interconnect (Local to each site)
      const activeSwitchModel = switchModel || "BES53248";
      if (halfNodes > 1) {
        // Site A cluster switch cabling
        for (let i = 1; i <= halfNodes; i++) {
          rows.push({ src: getNodeName(i), srcPort: ports.cluster[0], dest: `${switchAName} 1 (Site A)`, destPort: `Port ${i}`, type: "Cluster Interconnect (Fabric A)" });
          rows.push({ src: getNodeName(i), srcPort: ports.cluster[1], dest: `${switchBName} 1 (Site A)`, destPort: `Port ${i}`, type: "Cluster Interconnect (Fabric B)" });
        }
        // Site B cluster switch cabling
        for (let i = halfNodes + 1; i <= nodeCount; i++) {
          const portNum = i - halfNodes;
          rows.push({ src: getNodeName(i), srcPort: ports.cluster[0], dest: `${switchAName} 2 (Site B)`, destPort: `Port ${portNum}`, type: "Cluster Interconnect (Fabric A)" });
          rows.push({ src: getNodeName(i), srcPort: ports.cluster[1], dest: `${switchBName} 2 (Site B)`, destPort: `Port ${portNum}`, type: "Cluster Interconnect (Fabric B)" });
        }
      } else {
        // 2-node MetroCluster IP/FC (shared switches)
        rows.push({ src: getNodeName(1), srcPort: ports.cluster[0], dest: mcSwitchA1, destPort: "Port 9", type: "Cluster Interconnect (Fabric A)" });
        rows.push({ src: getNodeName(1), srcPort: ports.cluster[1], dest: mcSwitchB1, destPort: "Port 9", type: "Cluster Interconnect (Fabric B)" });
        rows.push({ src: getNodeName(2), srcPort: ports.cluster[0], dest: mcSwitchA2, destPort: "Port 9", type: "Cluster Interconnect (Fabric A)" });
        rows.push({ src: getNodeName(2), srcPort: ports.cluster[1], dest: mcSwitchB2, destPort: "Port 9", type: "Cluster Interconnect (Fabric B)" });
      }

      // 2. Storage Cabling (Shelves local to each site)
      const numPairs = Math.max(1, halfNodes / 2);
      const shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
      const sizingInfo = getExpansionCardsAndPorts(model, state.sizing.shelfType, shelvesPerPair);

      // Site A shelves
      for (let s = 1; s <= shelfCount; s++) {
        const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
        let nodeA, nodeB;
        if (halfNodes === 1) {
          nodeA = 1;
          nodeB = 1;
        } else {
          nodeA = 2 * pairIdx - 1;
          nodeB = 2 * pairIdx;
        }
        
        const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
        const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
        const activePorts = sizingInfo.portPairs[stackIdx] || sizingInfo.portPairs[sizingInfo.portPairs.length - 1];
        
        rows.push({ src: getNodeName(nodeA), srcPort: activePorts[0], dest: `Shelf A${s} NSM A`, destPort: "Port e0a", type: `Storage HA Multipath A (${nodeA}->A)` });
        rows.push({ src: getNodeName(nodeA), srcPort: activePorts[1], dest: `Shelf A${s} NSM B`, destPort: "Port e0b", type: `Storage HA Multipath B (${nodeA}->B)` });
        if (nodeB !== nodeA && nodeB <= halfNodes) {
          rows.push({ src: getNodeName(nodeB), srcPort: activePorts[0], dest: `Shelf A${s} NSM B`, destPort: "Port e0a", type: `Storage HA Multipath A (${nodeB}->B)` });
          rows.push({ src: getNodeName(nodeB), srcPort: activePorts[1], dest: `Shelf A${s} NSM A`, destPort: "Port e0b", type: `Storage HA Multipath B (${nodeB}->A)` });
        }
      }

      // Site B shelves
      for (let s = 1; s <= shelfCount; s++) {
        const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
        let nodeA, nodeB;
        if (halfNodes === 1) {
          nodeA = 2;
          nodeB = 2;
        } else {
          nodeA = halfNodes + 2 * pairIdx - 1;
          nodeB = halfNodes + 2 * pairIdx;
        }
        
        const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
        const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
        const activePorts = sizingInfo.portPairs[stackIdx] || sizingInfo.portPairs[sizingInfo.portPairs.length - 1];
        
        rows.push({ src: getNodeName(nodeA), srcPort: activePorts[0], dest: `Shelf B${s} NSM A`, destPort: "Port e0a", type: `Storage HA Multipath A (${nodeA}->A)` });
        rows.push({ src: getNodeName(nodeA), srcPort: activePorts[1], dest: `Shelf B${s} NSM B`, destPort: "Port e0b", type: `Storage HA Multipath B (${nodeA}->B)` });
        if (nodeB !== nodeA && nodeB <= nodeCount) {
          rows.push({ src: getNodeName(nodeB), srcPort: activePorts[0], dest: `Shelf B${s} NSM B`, destPort: "Port e0a", type: `Storage HA Multipath A (${nodeB}->B)` });
          rows.push({ src: getNodeName(nodeB), srcPort: activePorts[1], dest: `Shelf B${s} NSM A`, destPort: "Port e0b", type: `Storage HA Multipath B (${nodeB}->A)` });
        }
      }

      // 3. Management (Mgmt switch local to each site)
      for (let i = 1; i <= nodeCount; i++) {
        const site = i <= halfNodes ? "Site A" : "Site B";
        const portNum = i <= halfNodes ? i : i - halfNodes;
        rows.push({ src: getNodeName(i), srcPort: ports.management, dest: `Mgmt Switch (${site})`, destPort: `Port ${10 + portNum}`, type: `Node Management (Node ${i})` });
      }

      // 4. Data Links (Data switches local to each site)
      let dataLinkType = "NAS / Ethernet Data";
      if (["iscsi", "nvme_tcp"].includes(proto)) dataLinkType = "IP SAN / Ethernet Data";
      if (["fc", "fcoe", "nvme_fc"].includes(proto)) dataLinkType = "FC SAN / Fibre Channel Fabric";

      for (let i = 1; i <= nodeCount; i++) {
        const site = i <= halfNodes ? "Site A" : "Site B";
        const portNum = i <= halfNodes ? i : i - halfNodes;
        rows.push({ src: getNodeName(i), srcPort: ports.data[0], dest: `${switchAName} ${i <= halfNodes ? '1' : '2'} (${site})`, destPort: `Port ${portNum}`, type: dataLinkType });
        rows.push({ src: getNodeName(i), srcPort: ports.data[1], dest: `${switchBName} ${i <= halfNodes ? '1' : '2'} (${site})`, destPort: `Port ${portNum}`, type: dataLinkType });
      }

      // 5. MetroCluster Peering Ports
      const mcPortA = isIp ? "e5a" : "fc1";
      const mcPortB = isIp ? "e5b" : "fc2";
      for (let i = 1; i <= nodeCount; i++) {
        const isSiteA = i <= halfNodes;
        const portNum = isSiteA ? i : i - halfNodes;
        const destA = isSiteA ? mcSwitchA1 : mcSwitchA2;
        const destB = isSiteA ? mcSwitchB1 : mcSwitchB2;
        rows.push({ src: getNodeName(i), srcPort: mcPortA, dest: destA, destPort: `Port ${portNum}`, type: mcLinkType });
        rows.push({ src: getNodeName(i), srcPort: mcPortB, dest: destB, destPort: `Port ${portNum}`, type: mcLinkType });
      }

      // 6. ISL Peering Links (cross-site)
      const labelA1 = isIp ? `${switchAName} 1 (Site A)` : `Brocade FC-${switchAName} 1 (Site A)`;
      const labelA2 = isIp ? `${switchAName} 2 (Site B)` : `Brocade FC-${switchAName} 2 (Site B)`;
      const labelB1 = isIp ? `${switchBName} 1 (Site A)` : `Brocade FC-${switchBName} 1 (Site A)`;
      const labelB2 = isIp ? `${switchBName} 2 (Site B)` : `Brocade FC-${switchBName} 2 (Site B)`;
      
      rows.push({ src: labelA1, srcPort: "Port 35", dest: labelA2, destPort: "Port 35", type: "MetroCluster ISL (Trunk 1)" });
      rows.push({ src: labelA1, srcPort: "Port 36", dest: labelA2, destPort: "Port 36", type: "MetroCluster ISL (Trunk 2)" });
      rows.push({ src: labelB1, srcPort: "Port 35", dest: labelB2, destPort: "Port 35", type: "MetroCluster ISL (Trunk 1)" });
      rows.push({ src: labelB1, srcPort: "Port 36", dest: labelB2, destPort: "Port 36", type: "MetroCluster ISL (Trunk 2)" });
    } else {
      // 1. Cluster Interconnect
      if (nodeCount === 2 && clusterCabling === "direct") {
        rows.push({ src: getNodeName(1), srcPort: ports.cluster[0], dest: getNodeName(2), destPort: ports.cluster[0], type: "Cluster Interconnect (Direct Path 1)" });
        rows.push({ src: getNodeName(1), srcPort: ports.cluster[1], dest: getNodeName(2), destPort: ports.cluster[1], type: "Cluster Interconnect (Direct Path 2)" });
      } else {
        // Switched cluster cabling is mandatory if nodeCount > 2
        const activeSwitchModel = nodeCount > 2 ? (switchModel || "BES53248") : switchModel;
        for (let i = 1; i <= nodeCount; i++) {
          rows.push({ src: getNodeName(i), srcPort: ports.cluster[0], dest: `${switchAName} (${activeSwitchModel})`, destPort: `Port ${i}`, type: "Cluster Interconnect (Fabric A)" });
          rows.push({ src: getNodeName(i), srcPort: ports.cluster[1], dest: `${switchBName} (${activeSwitchModel})`, destPort: `Port ${i}`, type: "Cluster Interconnect (Fabric B)" });
        }
      }

      // 2. Storage Cabling (shelves distributed across HA pairs)
      const numPairs = Math.max(1, nodeCount / 2);
      const shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
      const sizingInfo = getExpansionCardsAndPorts(model, state.sizing.shelfType, shelvesPerPair);
      
      for (let s = 1; s <= shelfCount; s++) {
        const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
        const nodeA = 2 * pairIdx - 1;
        const nodeB = 2 * pairIdx;
        
        const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
        const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
        const activePorts = sizingInfo.portPairs[stackIdx] || sizingInfo.portPairs[sizingInfo.portPairs.length - 1];
        
        rows.push({ src: getNodeName(nodeA), srcPort: activePorts[0], dest: `Shelf ${s} NSM A`, destPort: "Port e0a", type: `Storage HA Multipath A (${nodeA}->A)` });
        rows.push({ src: getNodeName(nodeA), srcPort: activePorts[1], dest: `Shelf ${s} NSM B`, destPort: "Port e0b", type: `Storage HA Multipath B (${nodeA}->B)` });
        if (nodeB <= nodeCount) {
          rows.push({ src: getNodeName(nodeB), srcPort: activePorts[0], dest: `Shelf ${s} NSM B`, destPort: "Port e0a", type: `Storage HA Multipath A (${nodeB}->B)` });
          rows.push({ src: getNodeName(nodeB), srcPort: activePorts[1], dest: `Shelf ${s} NSM A`, destPort: "Port e0b", type: `Storage HA Multipath B (${nodeB}->A)` });
        }
      }

      // 3. Management
      for (let i = 1; i <= nodeCount; i++) {
        rows.push({ src: getNodeName(i), srcPort: ports.management, dest: "Management Switch", destPort: `Port ${10 + i}`, type: `Node Management (Node ${i})` });
      }

      // 4. Data links
      let dataLinkType = "NAS / Ethernet Data";
      if (["iscsi", "nvme_tcp"].includes(proto)) dataLinkType = "IP SAN / Ethernet Data";
      if (["fc", "fcoe", "nvme_fc"].includes(proto)) dataLinkType = "FC SAN / Fibre Channel Fabric";

      for (let i = 1; i <= nodeCount; i++) {
        rows.push({ src: getNodeName(i), srcPort: ports.data[0], dest: `${switchAName} (Data Fabric A)`, destPort: `Port ${i}`, type: dataLinkType });
        rows.push({ src: getNodeName(i), srcPort: ports.data[1], dest: `${switchBName} (Data Fabric B)`, destPort: `Port ${i}`, type: dataLinkType });
      }
    }
  }
  
  return rows;
}

function updateCablingPlanner() {
  const model = state.sizing.controller;
  const nodeCount = parseInt(state.sizing.nodeCount) || 2;
  const clusterCabling = state.sizing.clusterCabling;
  const switchModel = state.sizing.clusterSwitchModel;
  const ports = getControllerPorts(model);
  const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));

  const isSg = state.platform === "storagegrid";
  const cablingMatrixContainer = document.querySelector("#stepPanel3 .cabling-matrix-container");

  if (isSg) {
    if (cablingMatrixContainer) cablingMatrixContainer.style.display = "";
    const interconnectGroup = document.querySelector("#stepPanel3 .form-group");
    if (interconnectGroup) interconnectGroup.style.display = "none";
    const switchModelGroup = document.getElementById("clusterSwitchModelGroup");
    if (switchModelGroup) switchModelGroup.style.display = "none";
    const notice = document.getElementById("sgCablingNotice");
    if (notice) notice.style.display = "none";
  } else {
    if (cablingMatrixContainer) cablingMatrixContainer.style.display = "block";
    const interconnectGroup = document.querySelector("#stepPanel3 .form-group");
    if (interconnectGroup) interconnectGroup.style.display = "block";
    const switchModelGroup = document.getElementById("clusterSwitchModelGroup");
    if (switchModelGroup) {
      switchModelGroup.style.display = state.sizing.clusterCabling === "switched" ? "block" : "none";
    }
    const notice = document.getElementById("sgCablingNotice");
    if (notice) notice.style.display = "none";
  }

  const tbody = document.getElementById("cablingTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const reviewTbody = document.getElementById("reviewCablingTableBody");
  if (reviewTbody) reviewTbody.innerHTML = "";

  const rows = generateCablingRows();

  rows.forEach(r => {
    let badgeStyle = "background:rgba(0,242,254,0.08);color:var(--color-accent-cyan);border-color:rgba(0,242,254,0.2);"; // Cluster/Grid
    if (r.type.includes("Client") || r.type.includes("Data")) {
      badgeStyle = "background:rgba(168,85,247,0.08);color:#a855f7;border-color:rgba(168,85,247,0.2);"; // Data/Client
    } else if (r.type.includes("Admin") || r.type.includes("Management")) {
      badgeStyle = "background:rgba(255,255,255,0.08);color:#fff;border-color:rgba(255,255,255,0.2);"; // Admin/Mgmt
    } else if (r.type.includes("Storage")) {
      badgeStyle = "background:rgba(16,185,129,0.08);color:#10b981;border-color:rgba(16,185,129,0.2);"; // Storage
    } else if (r.type.includes("MetroCluster")) {
      badgeStyle = "background:rgba(245,158,11,0.08);color:#f59e0b;border-color:rgba(245,158,11,0.2);"; // MetroCluster
    }
    
    const rowHtml = `
      <td><strong>${r.src}</strong></td>
      <td><span class="parser-badge pending" style="background:rgba(255,255,255,0.05);color:#fff;border-color:rgba(255,255,255,0.1);">${r.srcPort}</span></td>
      <td><strong>${r.dest}</strong></td>
      <td><span class="parser-badge success" style="${badgeStyle}">${r.destPort}</span></td>
      <td><span class="step-subtitle-text">${r.type}</span></td>
    `;
    
    const tr = document.createElement("tr");
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);

    if (reviewTbody) {
      if (!r.type.includes("Storage HA")) {
        const trRev = document.createElement("tr");
        trRev.innerHTML = rowHtml;
        reviewTbody.appendChild(trRev);
      }
    }
  });

  // ASCII Diagram generation
  let ascii = ``;
  ascii += `=====================================================================\n`;
  ascii += `               PHYSICAL TOPOLOGY CABLING DIAGRAM                    \n`;
  ascii += `   System Hardware Profile: ${model} | Cluster Mode: ${isSg ? "GRID" : clusterCabling.toUpperCase()}\n`;
  ascii += `=====================================================================\n\n`;

  if (isSg) {
    ascii += `[ADMINISTRATION NETWORK]\n`;
    rows.filter(r => r.type.includes("Admin")).forEach(r => {
      ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
    });
    ascii += `\n`;

    ascii += `[GRID NETWORK FABRIC]\n`;
    rows.filter(r => r.type.includes("Grid")).forEach(r => {
      ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
    });
    ascii += `\n`;

    if (rows.some(r => r.type.includes("Client"))) {
      ascii += `[CLIENT NETWORK FABRIC (S3 ACCESS)]\n`;
      rows.filter(r => r.type.includes("Client")).forEach(r => {
        ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
      });
      ascii += `\n`;
    }
  } else {
    ascii += `[CLUSTER INTERCONNECT]\n`;
    if (nodeCount === 2 && clusterCabling === "direct") {
      ascii += `   Node 1 [${ports.cluster[0]}] <===============================> Node 2 [${ports.cluster[0]}]\n`;
      ascii += `   Node 1 [${ports.cluster[1]}] <===============================> Node 2 [${ports.cluster[1]}]\n`;
    } else {
      rows.filter(r => r.type.includes("Cluster Interconnect")).forEach(r => {
        ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
      });
    }
    ascii += `\n`;

    ascii += `[STORAGE CABINET CABLING]\n`;
    rows.filter(r => r.type.includes("Storage")).forEach(r => {
      ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
    });
    ascii += `\n`;

    ascii += `[MANAGEMENT & NETWORK]\n`;
    rows.filter(r => r.type.includes("Management")).forEach(r => {
      ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
    });
    ascii += `\n`;

    ascii += `[DATA FABRIC SERVICES]\n`;
    rows.filter(r => r.type.includes("Data")).forEach(r => {
      ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
    });
    ascii += `\n`;
    
    if (state.metrocluster && state.metrocluster.enabled) {
      ascii += `[METROCLUSTER GEOGRAPHIC REPLICATION & PEERING]\n`;
      rows.filter(r => r.type.includes("MetroCluster")).forEach(r => {
        ascii += `   ${r.src} [${r.srcPort}] -----------------------------> ${r.dest} [${r.destPort}]\n`;
      });
      ascii += `\n`;
    }
  }

  const cablingAsciiDiagram = document.getElementById("cablingAsciiDiagram");
  if (cablingAsciiDiagram) cablingAsciiDiagram.textContent = ascii;

  const reviewCablingAsciiDiagram = document.getElementById("reviewCablingAsciiDiagram");
  if (reviewCablingAsciiDiagram) reviewCablingAsciiDiagram.textContent = ascii;

  const svgPhysical = generateSvgPhysicalCabling();
  const cablingSvgContainer = document.getElementById("cablingSvgContainer");
  if (cablingSvgContainer) cablingSvgContainer.innerHTML = svgPhysical;

  const reviewCablingSvgContainer = document.getElementById("reviewCablingSvgContainer");
  if (reviewCablingSvgContainer) reviewCablingSvgContainer.innerHTML = svgPhysical;

  // Render dedicated storage cabling table & SVG diagram
  const reviewStorageTbody = document.getElementById("reviewStorageCablingTableBody");
  if (reviewStorageTbody) {
    reviewStorageTbody.innerHTML = "";
    rows.filter(r => r.type.includes("Storage HA")).forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${r.src}</strong></td>
        <td><span class="parser-badge pending" style="background:rgba(255,255,255,0.05);color:#fff;border-color:rgba(255,255,255,0.1);">${r.srcPort}</span></td>
        <td><strong>${r.dest}</strong></td>
        <td><span class="parser-badge success" style="background:rgba(16,185,129,0.08);color:#10b981;border-color:rgba(16,185,129,0.2);">${r.destPort}</span></td>
        <td><span class="step-subtitle-text" style="color:#10b981;font-weight:600;">${r.type}</span></td>
      `;
      reviewStorageTbody.appendChild(tr);
    });
  }

  const reviewStorageCablingSvgContainer = document.getElementById("reviewStorageCablingSvgContainer");
  if (reviewStorageCablingSvgContainer) {
    reviewStorageCablingSvgContainer.innerHTML = generateSvgStorageOnlyCabling();
  }
}

function updateQosFieldsVisibility(type) {
  const std = document.getElementById("qosStandardFields");
  const adapt = document.getElementById("qosAdaptiveFields");
  if (!std || !adapt) return;
  
  if (type === "none") {
    std.style.display = "none";
    adapt.style.display = "none";
  } else if (type === "shared" || type === "non_shared") {
    std.style.display = "grid";
    adapt.style.display = "none";
  } else if (type === "adaptive") {
    std.style.display = "none";
    adapt.style.display = "grid";
  }
}

function calculateTenantPhysicalGb(quota, sites, ilm) {
  let factor = 1.5;
  if (ilm === "2_copies") factor = 2;
  else if (ilm === "3_copies") factor = 3;
  
  if (ilm.startsWith("ec_")) {
    return quota * factor;
  } else {
    return quota * factor * sites;
  }
}

function renderSgTenantTable() {
  const tbody = document.getElementById("sgTenantTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  state.sgTenants.forEach((tenant, index) => {
    const tr = document.createElement("tr");

    // Tenant Name input
    const tdName = document.createElement("td");
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.className = "form-control";
    inputName.value = tenant.name;
    inputName.addEventListener("input", (e) => {
      const oldName = tenant.name;
      tenant.name = e.target.value;
      // Sync buckets owner tenant name
      state.sgBuckets.forEach(b => {
        if (b.tenantName === oldName) b.tenantName = tenant.name;
      });
      renderSgBucketTable();
      updateCodePreview();
      validateForm();
    });
    tdName.appendChild(inputName);

    // Quota input
    const tdQuota = document.createElement("td");
    const inputQuota = document.createElement("input");
    inputQuota.type = "number";
    inputQuota.className = "form-control";
    inputQuota.value = tenant.quota;
    inputQuota.min = "0";
    tdQuota.appendChild(inputQuota);

    // Sites input
    const tdSites = document.createElement("td");
    const selectSites = document.createElement("select");
    selectSites.className = "form-control";
    [1, 2, 3].forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.innerText = `${s} Site${s > 1 ? 's' : ''}`;
      opt.selected = (tenant.sites || 1) === s;
      selectSites.appendChild(opt);
    });
    tdSites.appendChild(selectSites);

    // ILM input
    const tdIlm = document.createElement("td");
    const selectIlm = document.createElement("select");
    selectIlm.className = "form-control";
    const ilmOptions = [
      { val: "2_copies", label: "2-Copy Replication" },
      { val: "3_copies", label: "3-Copy Replication" },
      { val: "ec_2_1", label: "EC 2+1" },
      { val: "ec_4_2", label: "EC 4+2" },
      { val: "ec_6_3", label: "EC 6+3" }
    ];
    ilmOptions.forEach(opt => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.val;
      optionEl.innerText = opt.label;
      optionEl.selected = (tenant.ilmPolicy || "2_copies") === opt.val;
      selectIlm.appendChild(optionEl);
    });
    tdIlm.appendChild(selectIlm);

    // Est. Physical displays
    const tdPhysical = document.createElement("td");
    const updatePhysDisplay = () => {
      const qVal = Number(inputQuota.value) || 0;
      const sVal = Number(selectSites.value) || 1;
      const iVal = selectIlm.value || "2_copies";
      const physGb = calculateTenantPhysicalGb(qVal, sVal, iVal);
      tdPhysical.innerHTML = `<span style="font-weight: 600; color: var(--color-accent-cyan);">${formatCapacity(physGb)}</span>`;
    };
    updatePhysDisplay();

    // Event listeners calling updatePhysDisplay
    inputQuota.addEventListener("input", (e) => {
      tenant.quota = Number(e.target.value);
      updatePhysDisplay();
      updateCodePreview();
      validateForm();
    });
    selectSites.addEventListener("change", (e) => {
      tenant.sites = Number(e.target.value);
      updatePhysDisplay();
      updateCodePreview();
      validateForm();
    });
    selectIlm.addEventListener("change", (e) => {
      tenant.ilmPolicy = e.target.value;
      updatePhysDisplay();
      updateCodePreview();
      validateForm();
    });

    // Access Protocol description (S3 / Swift)
    const tdProtocol = document.createElement("td");
    const selectProtocol = document.createElement("select");
    selectProtocol.className = "form-control";
    const optS3 = document.createElement("option");
    optS3.value = "s3";
    optS3.innerText = "S3 (Standard)";
    optS3.selected = tenant.protocol === "s3" || !tenant.protocol;
    const optSwift = document.createElement("option");
    optSwift.value = "swift";
    optSwift.innerText = "Swift (Legacy)";
    optSwift.selected = tenant.protocol === "swift";
    selectProtocol.appendChild(optS3);
    selectProtocol.appendChild(optSwift);
    selectProtocol.addEventListener("change", (e) => {
      tenant.protocol = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdProtocol.appendChild(selectProtocol);

    // Allow Platform Services Checkbox
    const tdServices = document.createElement("td");
    const checkServices = document.createElement("input");
    checkServices.type = "checkbox";
    checkServices.checked = tenant.allowPlatformServices !== false;
    checkServices.addEventListener("change", (e) => {
      tenant.allowPlatformServices = e.target.checked;
      updateCodePreview();
      validateForm();
    });
    tdServices.appendChild(checkServices);

    // Delete button
    const tdDel = document.createElement("td");
    if (state.sgTenants.length > 1) {
      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-trash";
      btnDel.innerHTML = `<i data-lucide="trash-2" style="width:14px;height:14px;"></i>`;
      btnDel.addEventListener("click", () => {
        state.sgTenants.splice(index, 1);
        // Default orphan buckets to first tenant
        state.sgBuckets.forEach(b => {
          if (!state.sgTenants.some(t => t.name === b.tenantName)) {
            b.tenantName = state.sgTenants[0].name;
          }
        });
        renderSgTenantTable();
        renderSgBucketTable();
        updateSummaryPanel();
        updateCodePreview();
        validateForm();
      });
      tdDel.appendChild(btnDel);
    }

    tr.appendChild(tdName);
    tr.appendChild(tdQuota);
    tr.appendChild(tdSites);
    tr.appendChild(tdIlm);
    tr.appendChild(tdPhysical);
    tr.appendChild(tdProtocol);
    tr.appendChild(tdServices);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });

  safeCreateIcons();
}

function renderSgBucketTable() {
  const tbody = document.getElementById("sgBucketTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  state.sgBuckets.forEach((bucket, index) => {
    if (state.version !== "12.0") {
      bucket.bucketBranches = false;
    }
    const tr = document.createElement("tr");

    // Bucket Name
    const tdName = document.createElement("td");
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.className = "form-control";
    inputName.value = bucket.name;
    inputName.addEventListener("input", (e) => {
      bucket.name = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdName.appendChild(inputName);

    // Owner Tenant
    const tdTenant = document.createElement("td");
    const selectTenant = document.createElement("select");
    selectTenant.className = "form-control";
    state.sgTenants.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.name;
      opt.innerText = t.name;
      opt.selected = bucket.tenantName === t.name;
      selectTenant.appendChild(opt);
    });
    selectTenant.addEventListener("change", (e) => {
      bucket.tenantName = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdTenant.appendChild(selectTenant);

    // Region
    const tdRegion = document.createElement("td");
    const inputRegion = document.createElement("input");
    inputRegion.type = "text";
    inputRegion.className = "form-control";
    inputRegion.value = bucket.region || "us-east-1";
    inputRegion.addEventListener("input", (e) => {
      bucket.region = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdRegion.appendChild(inputRegion);

    // Versioning
    const tdVersioning = document.createElement("td");
    const checkVersioning = document.createElement("input");
    checkVersioning.type = "checkbox";
    checkVersioning.checked = bucket.versioning;
    checkVersioning.addEventListener("change", (e) => {
      bucket.versioning = e.target.checked;
      updateCodePreview();
    });
    tdVersioning.appendChild(checkVersioning);

    // Object Lock
    const tdLock = document.createElement("td");
    const checkLock = document.createElement("input");
    checkLock.type = "checkbox";
    checkLock.checked = bucket.objectLock;
    checkLock.addEventListener("change", (e) => {
      bucket.objectLock = e.target.checked;
      renderSgBucketTable(); // re-render to show/hide retention field
      updateCodePreview();
      validateForm();
    });
    tdLock.appendChild(checkLock);

    // Retention Days
    const tdRetention = document.createElement("td");
    if (bucket.objectLock) {
      const inputRetention = document.createElement("input");
      inputRetention.type = "number";
      inputRetention.className = "form-control";
      inputRetention.value = bucket.retentionDays || 30;
      inputRetention.min = "1";
      inputRetention.style.width = "70px";
      inputRetention.addEventListener("input", (e) => {
        bucket.retentionDays = Number(e.target.value);
        updateCodePreview();
        validateForm();
      });
      tdRetention.appendChild(inputRetention);
    } else {
      tdRetention.innerText = "-";
      tdRetention.style.textAlign = "center";
      tdRetention.style.color = "var(--text-muted)";
    }

    // Delete Button
    const tdDel = document.createElement("td");
    if (state.sgBuckets.length > 1) {
      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-trash";
      btnDel.innerHTML = `<i data-lucide="trash-2" style="width:14px;height:14px;"></i>`;
      btnDel.addEventListener("click", () => {
        state.sgBuckets.splice(index, 1);
        renderSgBucketTable();
        updateSummaryPanel();
        updateCodePreview();
        validateForm();
      });
      tdDel.appendChild(btnDel);
    }

    tr.appendChild(tdName);
    tr.appendChild(tdTenant);
    tr.appendChild(tdRegion);
    tr.appendChild(tdVersioning);
    tr.appendChild(tdLock);
    tr.appendChild(tdRetention);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);

    // Nested platform services row
    const servicesTr = document.createElement("tr");
    servicesTr.className = "services-details-row";
    servicesTr.style.background = "rgba(0, 0, 0, 0.15)";
    
    const servicesTd = document.createElement("td");
    servicesTd.colSpan = 7;
    servicesTd.style.padding = "10px 20px";

    // Build the checkbox grid for Platform Services
    let servicesHtml = `
      <div style="border-left: 2px solid var(--color-accent-cyan); padding-left: 16px; margin: 4px 0 8px 0;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-accent-cyan); font-weight: 700; display: block; margin-bottom: 8px;">
          Bucket S3 Platform Services & Replication
        </span>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" class="sg-event-check" ${bucket.eventNotifications ? 'checked' : ''}>
            Event Notifications (SNS Trigger)
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" class="sg-mirror-check" ${bucket.cloudMirror ? 'checked' : ''}>
            CloudMirror Replication
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" class="sg-search-check" ${bucket.searchIntegration ? 'checked' : ''}>
            Metadata Search Integration (Elasticsearch)
          </label>
          <label class="sg12-only-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; opacity: ${state.version === '12.0' ? '1' : '0.4'}; pointer-events: ${state.version === '12.0' ? 'auto' : 'none'};">
            <input type="checkbox" class="sg-branch-check" ${bucket.bucketBranches ? 'checked' : ''} ${state.version === '12.0' ? '' : 'disabled'}>
            Bucket Branches (Dataset Copies)
          </label>
        </div>
      </div>
    `;

    servicesTd.innerHTML = servicesHtml;
    servicesTr.appendChild(servicesTd);
    tbody.appendChild(servicesTr);

    // Bind events to platform services inputs
    servicesTd.querySelector(".sg-event-check").addEventListener("change", (e) => {
      bucket.eventNotifications = e.target.checked;
      updateCodePreview();
    });
    servicesTd.querySelector(".sg-mirror-check").addEventListener("change", (e) => {
      bucket.cloudMirror = e.target.checked;
      updateCodePreview();
    });
    servicesTd.querySelector(".sg-search-check").addEventListener("change", (e) => {
      bucket.searchIntegration = e.target.checked;
      updateCodePreview();
    });
    servicesTd.querySelector(".sg-branch-check").addEventListener("change", (e) => {
      bucket.bucketBranches = e.target.checked;
      updateCodePreview();
    });
  });

  safeCreateIcons();
}

// 7. DYNAMIC RESOURCE RENDERERS
function renderSvmTable() {
  const tbody = document.getElementById("svmTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  state.svms.forEach((svm, index) => {
    const tr = document.createElement("tr");
    
    // SVM Name input
    const tdName = document.createElement("td");
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.className = "form-control";
    inputName.value = svm.name;
    inputName.addEventListener("input", (e) => {
      // Keep volumes in sync with renamed SVM
      const oldName = svm.name;
      svm.name = e.target.value;
      state.volumes.forEach(v => {
        if (v.svmName === oldName) v.svmName = svm.name;
      });
      renderVolumeTable();
      updateCodePreview();
      validateForm();
    });
    tdName.appendChild(inputName);

    // IP Address input
    const tdIp = document.createElement("td");
    const inputIp = document.createElement("input");
    inputIp.type = "text";
    inputIp.className = "form-control";
    inputIp.value = svm.dataIp;
    inputIp.addEventListener("input", (e) => {
      svm.dataIp = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdIp.appendChild(inputIp);

    // Allowed Access description
    const tdAccess = document.createElement("td");
    tdAccess.style.color = "var(--text-muted)";
    const activeProtos = state.protocols || [state.protocol];
    tdAccess.innerText = activeProtos.map(p => p.toUpperCase()).join(", ") + " Enabled";

    // Delete action
    const tdDel = document.createElement("td");
    if (state.svms.length > 1) {
      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-trash";
      btnDel.innerHTML = `<i data-lucide="trash-2" style="width:14px;height:14px;"></i>`;
      btnDel.addEventListener("click", () => {
        state.svms.splice(index, 1);
        // Default orphan volumes to the first SVM in list
        state.volumes.forEach(v => {
          if (!state.svms.find(s => s.name === v.svmName)) {
            v.svmName = state.svms[0].name;
          }
        });
        renderSvmTable();
        renderVolumeTable();
        updateSummaryPanel();
        updateCodePreview();
        validateForm();
      });
      tdDel.appendChild(btnDel);
    }

    tr.appendChild(tdName);
    tr.appendChild(tdIp);
    tr.appendChild(tdAccess);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
  
  safeCreateIcons();
}

function renderVolumeTable() {
  const tbody = document.getElementById("volumeTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  state.volumes.forEach((vol, index) => {
    const tr = document.createElement("tr");

    // Volume Name
    const tdName = document.createElement("td");
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.className = "form-control";
    inputName.value = vol.name;
    inputName.addEventListener("input", (e) => {
      vol.name = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdName.appendChild(inputName);

    // Owner SVM dropdown select
    const tdSvm = document.createElement("td");
    const selectSvm = document.createElement("select");
    selectSvm.className = "form-control";
    state.svms.forEach(svm => {
      const opt = document.createElement("option");
      opt.value = svm.name;
      opt.innerText = svm.name;
      if (svm.name === vol.svmName) opt.selected = true;
      selectSvm.appendChild(opt);
    });
    selectSvm.addEventListener("change", (e) => {
      vol.svmName = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdSvm.appendChild(selectSvm);

    // Target Aggregate
    const tdAggr = document.createElement("td");
    const inputAggr = document.createElement("input");
    inputAggr.type = "text";
    inputAggr.className = "form-control";
    inputAggr.value = vol.aggregate;
    inputAggr.addEventListener("input", (e) => {
      vol.aggregate = e.target.value;
      updateCodePreview();
      validateForm();
    });
    tdAggr.appendChild(inputAggr);

    // Volume Type
    const tdType = document.createElement("td");
    const selectType = document.createElement("select");
    selectType.className = "form-control table-select";
    selectType.style.padding = "4px 8px";
    selectType.style.fontSize = "12px";
    
    const optNas = document.createElement("option");
    optNas.value = "nas";
    optNas.innerText = "File (NAS)";
    const optSan = document.createElement("option");
    optSan.value = "san";
    optSan.innerText = "Block (SAN / LUN)";
    
    selectType.appendChild(optNas);
    selectType.appendChild(optSan);
    
    const isVolSan = vol.type === "san" || (vol.luns && vol.luns.length > 0);
    selectType.value = isVolSan ? "san" : "nas";
    
    selectType.addEventListener("change", (e) => {
      const newType = e.target.value;
      vol.type = newType;
      if (newType === "san") {
        if (!vol.luns || vol.luns.length === 0) {
          vol.luns = [{
            id: 1,
            name: `lun_${vol.name}_1`,
            size: vol.size,
            sizeUnit: vol.sizeUnit,
            osType: "vmware"
          }];
        }
      } else {
        vol.luns = [];
      }
      renderVolumeTable();
      updateSummaryPanel();
      updateCodePreview();
      validateForm();
    });
    tdType.appendChild(selectType);

    // Size + Unit
    const tdSize = document.createElement("td");
    const sizeDiv = document.createElement("div");
    sizeDiv.style.display = "flex";
    sizeDiv.style.gap = "4px";

    const inputSize = document.createElement("input");
    inputSize.type = "number";
    inputSize.className = "form-control";
    inputSize.value = vol.size;
    inputSize.style.width = "60px";
    inputSize.addEventListener("input", (e) => {
      vol.size = Number(e.target.value);
      updateCodePreview();
      validateForm();
    });

    const selectUnit = document.createElement("select");
    selectUnit.className = "form-control";
    selectUnit.style.width = "50px";
    ["GB", "TB"].forEach(unit => {
      const opt = document.createElement("option");
      opt.value = unit;
      opt.innerText = unit;
      if (unit === vol.sizeUnit) opt.selected = true;
      selectUnit.appendChild(opt);
    });
    selectUnit.addEventListener("change", (e) => {
      vol.sizeUnit = e.target.value;
      updateCodePreview();
      validateForm();
    });

    sizeDiv.appendChild(inputSize);
    sizeDiv.appendChild(selectUnit);
    tdSize.appendChild(sizeDiv);

    // Est. IOPS column
    const tdIops = document.createElement("td");
    const inputIops = document.createElement("input");
    inputIops.type = "number";
    inputIops.className = "form-control";
    inputIops.value = vol.iops !== undefined ? vol.iops : 1000;
    inputIops.style.width = "75px";
    inputIops.addEventListener("input", (e) => {
      vol.iops = Number(e.target.value);
      updateCodePreview();
      validateForm();
    });
    tdIops.appendChild(inputIops);

    // Encryption Checkbox (NVE)
    const tdEnc = document.createElement("td");
    const inputEnc = document.createElement("input");
    inputEnc.type = "checkbox";
    inputEnc.checked = vol.encryption;
    inputEnc.addEventListener("change", (e) => {
      vol.encryption = e.target.checked;
      updateCodePreview();
    });
    tdEnc.appendChild(inputEnc);

    // FabricPool Tiering Policy Dropdown
    const tdFP = document.createElement("td");
    const selectFP = document.createElement("select");
    selectFP.className = "form-control table-select";
    selectFP.style.padding = "4px 8px";
    selectFP.style.fontSize = "12px";
    selectFP.style.minWidth = "110px";
    
    const policies = [
      { value: "none", label: "None" },
      { value: "auto", label: "Auto" },
      { value: "snapshot-only", label: "Snapshot-Only" },
      { value: "all", label: "All" },
      { value: "backup", label: "Backup" }
    ];
    
    policies.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.innerText = p.label;
      if (vol.fabricpool === p.value || (p.value === "auto" && vol.fabricpool === true) || (p.value === "none" && vol.fabricpool === false)) {
        opt.selected = true;
      }
      selectFP.appendChild(opt);
    });

    const coolingContainer = document.createElement("div");
    coolingContainer.style.marginTop = "4px";
    coolingContainer.style.display = (vol.fabricpool === "auto" || vol.fabricpool === "snapshot-only") ? "flex" : "none";
    coolingContainer.style.alignItems = "center";
    coolingContainer.style.gap = "4px";

    const coolingLabel = document.createElement("span");
    coolingLabel.innerText = "Cooling (days):";
    coolingLabel.style.fontSize = "10px";
    coolingLabel.style.color = "var(--text-secondary)";

    const inputCooling = document.createElement("input");
    inputCooling.type = "number";
    inputCooling.min = 2;
    inputCooling.max = 183;
    inputCooling.className = "form-control table-input";
    inputCooling.style.width = "55px";
    inputCooling.style.padding = "2px 4px";
    inputCooling.style.fontSize = "11px";
    inputCooling.value = vol.coolingDays || 31;

    inputCooling.addEventListener("change", (e) => {
      let val = parseInt(e.target.value) || 31;
      if (val < 2) val = 2;
      if (val > 183) val = 183;
      e.target.value = val;
      vol.coolingDays = val;
      updateCodePreview();
    });

    coolingContainer.appendChild(coolingLabel);
    coolingContainer.appendChild(inputCooling);
    
    selectFP.addEventListener("change", (e) => {
      vol.fabricpool = e.target.value;
      coolingContainer.style.display = (vol.fabricpool === "auto" || vol.fabricpool === "snapshot-only") ? "flex" : "none";
      
      // Auto-enable FabricPool settings target panel if they set policy to anything but none
      if (vol.fabricpool !== "none") {
        state.ontapFabricPool.enabled = true;
        const fpCheck = document.getElementById("ontapFabricPoolEnabled");
        if (fpCheck) {
          fpCheck.checked = true;
          document.getElementById("ontapFabricPoolFields").style.display = "block";
        }
      }
      
      updateSummaryPanel();
      updateCodePreview();
      validateForm();
    });
    tdFP.appendChild(selectFP);
    tdFP.appendChild(coolingContainer);

    // Remove Action
    const tdDel = document.createElement("td");
    if (state.volumes.length > 1) {
      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-trash";
      btnDel.innerHTML = `<i data-lucide="trash-2" style="width:14px;height:14px;"></i>`;
      btnDel.addEventListener("click", () => {
        state.volumes.splice(index, 1);
        renderVolumeTable();
        updateSummaryPanel();
        updateCodePreview();
        validateForm();
      });
      tdDel.appendChild(btnDel);
    }

    tr.appendChild(tdName);
    tr.appendChild(tdSvm);
    tr.appendChild(tdAggr);
    tr.appendChild(tdType);
    tr.appendChild(tdSize);
    tr.appendChild(tdIops);
    tr.appendChild(tdEnc);
    tr.appendChild(tdFP);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);

    // If the volume has LUNs (SAN type), render the LUNs details row
    const activeProtos = state.protocols || [state.protocol || "nfs"];
    if (state.platform === "ontap" && isVolSan) {
      const lunTr = document.createElement("tr");
      lunTr.className = "lun-details-row";
      lunTr.style.background = "rgba(0, 0, 0, 0.15)";
      
      const lunTd = document.createElement("td");
      lunTd.colSpan = 9;
      lunTd.style.padding = "10px 20px";
      
      const isNvme = activeProtos.some(p => p.startsWith("nvme"));
      const unitLabelText = isNvme ? "Namespace" : "LUN";

      let lunsHtml = `
        <div style="border-left: 2px solid var(--color-accent-cyan); padding-left: 16px; margin: 4px 0 8px 0;">
          <h4 style="font-size: 0.8rem; font-weight: 700; color: var(--color-accent-cyan); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <i data-lucide="database" style="width:14px;height:14px;"></i> Provisioned ${unitLabelText}s inside Volume ${vol.name}
          </h4>
          <table class="resource-table" style="margin-bottom: 8px; width: 100%; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1);">
            <thead>
              <tr>
                <th>${unitLabelText} Path / Name</th>
                <th>Size</th>
                <th>OS Host Type</th>
                <th style="width:30px;"></th>
              </tr>
            </thead>
            <tbody id="lunsTableBody_${vol.id}"></tbody>
          </table>
          <button class="btn btn-secondary btn-mini" type="button" id="btnAddLun_${vol.id}" style="font-size:0.75rem; padding: 4px 8px;">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Add ${unitLabelText}
          </button>
        </div>
      `;
      lunTd.innerHTML = lunsHtml;
      lunTr.appendChild(lunTd);
      tbody.appendChild(lunTr);

      // Populate LUN rows
      const lunsTbody = lunTr.querySelector(`#lunsTableBody_${vol.id}`);
      if (!vol.luns) vol.luns = [];
      
      vol.luns.forEach((lun, lIdx) => {
        const lTr = document.createElement("tr");

        // LUN Path / Name
        const lTdName = document.createElement("td");
        const lInputName = document.createElement("input");
        lInputName.type = "text";
        lInputName.className = "form-control";
        lInputName.value = lun.name;
        lInputName.style.padding = "4px 8px";
        lInputName.addEventListener("input", (e) => {
          lun.name = e.target.value;
          updateCodePreview();
          validateForm();
        });
        lTdName.appendChild(lInputName);

        // LUN Size
        const lTdSize = document.createElement("td");
        const lSizeDiv = document.createElement("div");
        lSizeDiv.style.display = "flex";
        lSizeDiv.style.gap = "4px";

        const lInputSize = document.createElement("input");
        lInputSize.type = "number";
        lInputSize.className = "form-control";
        lInputSize.value = lun.size;
        lInputSize.style.width = "65px";
        lInputSize.style.padding = "4px 8px";
        lInputSize.addEventListener("input", (e) => {
          lun.size = Number(e.target.value);
          updateCodePreview();
          validateForm();
        });

        const lUnitSpan = document.createElement("span");
        lUnitSpan.innerText = lun.sizeUnit;
        lUnitSpan.style.alignSelf = "center";
        lUnitSpan.style.fontSize = "0.8rem";

        lSizeDiv.appendChild(lInputSize);
        lSizeDiv.appendChild(lUnitSpan);
        lTdSize.appendChild(lSizeDiv);

        // OS Type dropdown
        const lTdOs = document.createElement("td");
        const lSelectOs = document.createElement("select");
        lSelectOs.className = "form-control";
        lSelectOs.style.padding = "4px 8px";
        
        const osOpts = isNvme ? [
          { val: "linux", label: "Linux Host (linux)" },
          { val: "vmware", label: "VMware ESXi (vmware)" },
          { val: "windows", label: "Windows Host (windows)" }
        ] : [
          { val: "vmware", label: "VMware ESXi (vmware)" },
          { val: "windows", label: "Hyper-V / Windows (windows)" },
          { val: "linux", label: "Linux / RedHat (linux)" },
          { val: "xen", label: "Citrix XenServer (xen)" }
        ];

        osOpts.forEach(opt => {
          const o = document.createElement("option");
          o.value = opt.val;
          o.innerText = opt.label;
          if (opt.val === lun.osType) o.selected = true;
          lSelectOs.appendChild(o);
        });
        lSelectOs.addEventListener("change", (e) => {
          lun.osType = e.target.value;
          updateCodePreview();
          validateForm();
        });
        lTdOs.appendChild(lSelectOs);

        // Delete button for LUN
        const lTdDel = document.createElement("td");
        if (vol.luns.length > 1) {
          const lBtnDel = document.createElement("button");
          lBtnDel.type = "button";
          lBtnDel.className = "btn-trash";
          lBtnDel.style.width = "24px";
          lBtnDel.style.height = "24px";
          lBtnDel.innerHTML = `<i data-lucide="trash-2" style="width:12px;height:12px;"></i>`;
          lBtnDel.addEventListener("click", () => {
            vol.luns.splice(lIdx, 1);
            renderVolumeTable();
            updateCodePreview();
            validateForm();
          });
          lTdDel.appendChild(lBtnDel);
        }

        lTr.appendChild(lTdName);
        lTr.appendChild(lTdSize);
        lTr.appendChild(lTdOs);
        lTr.appendChild(lTdDel);
        lunsTbody.appendChild(lTr);
      });

      // Add LUN button listener
      lunTr.querySelector(`#btnAddLun_${vol.id}`).addEventListener("click", () => {
        addLunToVolume(vol.id);
      });
    }
  });

  safeCreateIcons();
}

function addSvmRow() {
  const newId = state.svms.length + 1;
  const lastIp = state.svms[state.svms.length - 1].dataIp;
  // Auto-increment last octet of the IP address helper
  const ipParts = lastIp.split(".");
  if (ipParts.length === 4) {
    ipParts[3] = String(Number(ipParts[3]) + 1);
  }
  const newIp = ipParts.join(".");

  state.svms.push({
    id: newId,
    name: `svm_data_${newId}`,
    dataIp: newIp
  });

  renderSvmTable();
  renderVolumeTable(); // update owner selects
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
}

function addVolumeRow() {
  const newId = state.volumes.length + 1;
  const ownerSvm = state.svms[0].name;
  
  const isSan = isSanProtocol(state.protocol);
  const newVol = {
    id: newId,
    name: `vol_data_${newId}`,
    svmName: ownerSvm,
    aggregate: "aggr1",
    type: isSan ? "san" : "nas",
    size: 100,
    sizeUnit: "GB",
    iops: 1000,
    encryption: false,
    fabricpool: "none",
    coolingDays: 31,
    luns: []
  };

  if (isSan) {
    newVol.luns.push({
      id: 1,
      name: `lun_${newVol.name}_1`,
      size: 100,
      sizeUnit: "GB",
      osType: state.workload.hypervisor === "hyperv" ? "windows" : (state.workload.hypervisor === "esxi" ? "vmware" : "linux")
    });
  }

  state.volumes.push(newVol);

  renderVolumeTable();
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
}

// 8. STORAGE WORKLOAD STORAGE PROFILE AUTO-LAYOUT
function applyWorkloadStorageLayout() {
  const dbType = state.workload.db;
  if (dbType === "none") return;

  const defaultSvm = state.svms[0].name;

  if (dbType === "oracle") {
    state.volumes = [
      { id: 1, name: "vol_oracle_data", svmName: defaultSvm, aggregate: "aggr_nvme_1", size: 500, sizeUnit: "GB", encryption: true, fabricpool: false },
      { id: 2, name: "vol_oracle_redo", svmName: defaultSvm, aggregate: "aggr_nvme_1", size: 100, sizeUnit: "GB", encryption: true, fabricpool: false },
      { id: 3, name: "vol_oracle_arch", svmName: defaultSvm, aggregate: "aggr_ssd_2", size: 200, sizeUnit: "GB", encryption: false, fabricpool: true }
    ];
  } 
  else if (dbType === "mssql") {
    state.volumes = [
      { id: 1, name: "vol_sql_mdf", svmName: defaultSvm, aggregate: "aggr_nvme_1", size: 400, sizeUnit: "GB", encryption: true, fabricpool: false },
      { id: 2, name: "vol_sql_ldf", svmName: defaultSvm, aggregate: "aggr_nvme_1", size: 150, sizeUnit: "GB", encryption: true, fabricpool: false },
      { id: 3, name: "vol_sql_tempdb", svmName: defaultSvm, aggregate: "aggr_nvme_1", size: 100, sizeUnit: "GB", encryption: true, fabricpool: false }
    ];
  } 
  else if (dbType === "postgres") {
    state.volumes = [
      { id: 1, name: "vol_pg_data", svmName: defaultSvm, aggregate: "aggr_ssd_2", size: 300, sizeUnit: "GB", encryption: true, fabricpool: false },
      { id: 2, name: "vol_pg_wal", svmName: defaultSvm, aggregate: "aggr_nvme_1", size: 80, sizeUnit: "GB", encryption: true, fabricpool: false }
    ];
  }

  renderVolumeTable();
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
  alert(`Applied best practice database volume group layout for ${dbType.toUpperCase()}. Volume records updated!`);
}

// Utility to link DOM input events to state path updates dynamically
function setupInputsMapping(inputsList) {
  inputsList.forEach(item => {
    const element = document.getElementById(item.id);
    if (!element) return;
    
    const handler = (e) => {
      let val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      if (item.isNum) val = Number(val);
      if (item.isBool) val = e.target.checked;
      
      setValueByPath(state, item.path, val);
      
      updateSummaryPanel();
      updateCodePreview();
      validateForm();
    };
    
    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  });
}

function setValueByPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// 9. FORM CONTROL HANDLERS
function setDeploymentMode(mode) {
  state.mode = mode;
  document.getElementById("modeGreenfield").classList.toggle("selected", mode === "greenfield");
  document.getElementById("modeExisting").classList.toggle("selected", mode === "existing");
  
  const asupArea = document.getElementById("asupInputGroup");
  asupArea.style.display = mode === "existing" ? "flex" : "none";

  resetParsedFieldsTracker(mode === "existing");
  updateCodePreview();
  validateForm();
}

function setPlatform(platform) {
  state.platform = platform;
  document.getElementById("platformOntap").classList.toggle("selected", platform === "ontap");
  document.getElementById("platformStoragegrid").classList.toggle("selected", platform === "storagegrid");
  
  // Show/Hide respective fields
  document.getElementById("svmListOntapContainer").style.display = platform === "ontap" ? "block" : "none";
  document.getElementById("svmListSgContainer").style.display = platform === "storagegrid" ? "block" : "none";
  document.getElementById("volumeListOntapContainer").style.display = platform === "ontap" ? "block" : "none";
  document.getElementById("volumeListSgContainer").style.display = platform === "storagegrid" ? "block" : "none";

  const ontapPlatformGroup = document.getElementById("ontapPlatformGroup");
  if (ontapPlatformGroup) {
    ontapPlatformGroup.style.display = platform === "ontap" ? "block" : "none";
  }

  const metroclusterToggleGroup = document.getElementById("metroclusterToggleGroup");
  if (metroclusterToggleGroup) {
    metroclusterToggleGroup.style.display = platform === "ontap" ? "block" : "none";
  }
  const metroclusterConfigGroup = document.getElementById("metroclusterConfigGroup");
  if (metroclusterConfigGroup) {
    metroclusterConfigGroup.style.display = (platform === "ontap" && state.metrocluster && state.metrocluster.enabled) ? "block" : "none";
  }

  const ontapWorkloads = document.getElementById("ontapWorkloadsContainer");
  const sgWorkloads = document.getElementById("sgWorkloadsContainer");
  if (ontapWorkloads) ontapWorkloads.style.display = platform === "ontap" ? "block" : "none";
  if (sgWorkloads) sgWorkloads.style.display = platform === "storagegrid" ? "block" : "none";

  // Hide/Show Astra Trident tab since it is only applicable for ONTAP
  const tridentTabBtn = document.getElementById("tabTrident");
  if (tridentTabBtn) {
    if (platform === "storagegrid") {
      tridentTabBtn.style.display = "none";
      const activeTabEl = document.querySelector(".preview-tab.active");
      if (activeTabEl && activeTabEl.id === "tabTrident") {
        selectPreviewTab("code");
      }
    } else {
      tridentTabBtn.style.display = "";
    }
  }

  const protocolSelector = document.getElementById("protocolSelectorContainer");
  if (platform === "storagegrid") {
    protocolSelector.style.display = "none";
    state.protocols = ["storagegrid_s3"];
    state.protocol = "storagegrid_s3";
    updateProtocolFormsVisibility();
    renderSgTenantTable();
    renderSgBucketTable();
  } else {
    protocolSelector.style.display = "block";
    if (!state.protocols || state.protocols.includes("storagegrid_s3")) {
      state.protocols = ["nfs"];
    }
    updateProtocolFormsVisibility();
  }

  const isSg = platform === "storagegrid";

  // Hide/Show RAID options
  const wrapperSizingRaidType = document.getElementById("wrapperSizingRaidType");
  const rowSizingRaidDetails = document.getElementById("rowSizingRaidDetails");
  const rowSizingAggrName = document.getElementById("rowSizingAggrName");
  
  if (wrapperSizingRaidType) wrapperSizingRaidType.style.display = isSg ? "none" : "";
  if (rowSizingRaidDetails) rowSizingRaidDetails.style.display = isSg ? "none" : "";
  if (rowSizingAggrName) rowSizingAggrName.style.display = isSg ? "none" : "";

  // Dynamic step titles swapping (Steps 2, 4, 5)
  // Step 2 (Access Protocols / Grid Integrations)
  const navStep2 = document.getElementById("navStep2");
  if (navStep2) {
    navStep2.querySelector(".step-title-text").innerText = isSg ? "Grid Integrations" : "Access Protocols";
    navStep2.querySelector(".step-subtitle-text").innerText = isSg ? "Key Management & ILM" : "Access & Security";
  }
  const stepPanel2 = document.getElementById("stepPanel2");
  if (stepPanel2) {
    stepPanel2.querySelector(".step-title").innerText = isSg ? "Grid Integrations & ILM" : "Access Protocols";
    stepPanel2.querySelector(".step-description").innerText = isSg ? "Configure Identity Services, Key Management (KMS), platform services, and ILM rules." : "Select and configure the storage access protocol permissions.";
  }

  // Step 3 (SVM Manager / Tenant Manager)
  const navStep3 = document.getElementById("navStep3");
  if (navStep3) {
    navStep3.querySelector(".step-title-text").innerText = isSg ? "Tenant Manager" : "SVM Manager";
    navStep3.querySelector(".step-subtitle-text").innerText = isSg ? "S3 Tenant Accounts" : "Logical Storage VMs";
  }
  const stepPanel4 = document.getElementById("stepPanel4");
  if (stepPanel4) {
    stepPanel4.querySelector(".step-title").innerText = isSg ? "Tenant Accounts" : "Storage Virtual Machines (SVMs)";
    stepPanel4.querySelector(".step-description").innerText = isSg ? "Configure StorageGRID S3 Tenants and administrative access rules." : "Configure the secure logical storage partitioning servers.";
  }

  // Step 4 (Volume & LUNs / S3 Buckets)
  const navStep4 = document.getElementById("navStep4");
  if (navStep4) {
    navStep4.querySelector(".step-title-text").innerText = isSg ? "S3 Buckets" : "Volume & LUNs";
    navStep4.querySelector(".step-subtitle-text").innerText = isSg ? "Object Buckets" : "Provisioning & QoS";
  }
  const stepPanel5 = document.getElementById("stepPanel5");
  if (stepPanel5) {
    stepPanel5.querySelector(".step-title").innerText = isSg ? "S3 Buckets Provisioning" : "Volume & LUN Array Provisioning";
    stepPanel5.querySelector(".step-description").innerText = isSg ? "Configure S3 buckets, write consistency levels, versioning, and lifecycle options." : "Configure physical storage distribution, aggregate mapping, sizes, and efficiency rules.";
  }

  // Show/Hide Steps 5, 6 and 7 in the left nav panel and adjust badge numbers
  const navStep5 = document.getElementById("navStep5");
  const navStep6 = document.getElementById("navStep6");
  const navStep7 = document.getElementById("navStep7");
  if (navStep5) navStep5.style.display = isSg ? "none" : "";
  if (navStep6) navStep6.style.display = isSg ? "none" : "";
  if (navStep7) navStep7.style.display = isSg ? "none" : "";

  let badgeNum = 1;
  document.querySelectorAll(".nav-steps .nav-step").forEach(stepEl => {
    if (stepEl.style.display !== "none") {
      const badge = stepEl.querySelector(".step-number-badge");
      if (badge) badge.innerText = badgeNum++;
    }
  });

  // Handle page reset fallback if currently on a hidden step
  if (isSg && (state.currentStep === 5 || state.currentStep === 6 || state.currentStep === 7)) {
    showStep(4);
  }

  updateVersionOptions();
  updateSizingDropdownOptions();
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
}

function setProtocol(proto) {
  state.protocols = [proto];
  state.protocol = proto;
  updateProtocolFormsVisibility();
  renderSvmTable();
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
}

function toggleProtocol(proto) {
  if (!state.protocols) {
    state.protocols = [state.protocol || "nfs"];
  }

  const index = state.protocols.indexOf(proto);
  if (index > -1) {
    if (state.protocols.length > 1) {
      state.protocols.splice(index, 1);
    }
  } else {
    state.protocols.push(proto);
  }

  state.protocol = state.protocols[state.protocols.length - 1];

  updateProtocolFormsVisibility();
  renderSvmTable();
  updateSummaryPanel();
  updateCodePreview();
  validateForm();
}

function updateProtocolFormsVisibility() {
  document.querySelectorAll(".protocol-settings-form").forEach(form => form.style.display = "none");
  
  // Define supported protocols list based on platform and platform profile
  let supportedProtos = [];
  const isSg = state.platform === "storagegrid";

  if (isSg) {
    supportedProtos = ["storagegrid_s3"];
    state.protocols = ["storagegrid_s3"];
    state.protocol = "storagegrid_s3";
  } else {
    if (state.ontapPlatform === "asa") {
      supportedProtos = ["iscsi", "fc", "fcoe", "nvme_tcp", "nvme_fc"];
    } else {
      supportedProtos = ["nfs", "smb", "iscsi", "fc", "fcoe", "nvme_tcp", "nvme_fc", "ontap_s3"];
    }
  }

  // Update card disabled states live
  document.querySelectorAll("#protocolsSelectGrid .protocol-card").forEach(card => {
    const proto = card.getAttribute("data-protocol");
    const isSupported = supportedProtos.includes(proto);
    card.classList.toggle("disabled", !isSupported);
    card.classList.remove("selected");
  });

  if (isSg) return;

  // Filter out any selected protocols that are no longer supported
  if (state.protocols) {
    state.protocols = state.protocols.filter(p => supportedProtos.includes(p));
  }

  // If no supported protocols are left, select the first supported protocol as fallback
  if (!state.protocols || state.protocols.length === 0) {
    state.protocols = [supportedProtos[0]];
  }

  state.protocol = state.protocols[state.protocols.length - 1];

  // Render selected protocols forms and card state
  state.protocols.forEach(proto => {
    const card = document.querySelector(`#protocolsSelectGrid .protocol-card[data-protocol="${proto}"]`);
    if (card) card.classList.add("selected");

    const formEl = document.getElementById(`protocolForm_${proto}`);
    if (formEl) formEl.style.display = "block";
  });
}

function loadAsupText(text) {
  const area = document.getElementById("asupTextInput");
  area.value = text;
  parseAutoSupportText(text);
}

function selectPreviewTab(tab) {
  document.querySelectorAll(".preview-tab").forEach(t => t.classList.remove("active"));
  
  const previewCodeWrapper = document.getElementById("previewCodeWrapper");
  const previewVariablesWrapper = document.getElementById("previewVariablesWrapper");
  const previewValidationWrapper = document.getElementById("previewValidationWrapper");
  const previewGuideWrapper = document.getElementById("previewGuideWrapper");
  const previewProposalWrapper = document.getElementById("previewProposalWrapper");

  if (previewCodeWrapper) previewCodeWrapper.style.display = "none";
  if (previewVariablesWrapper) previewVariablesWrapper.style.display = "none";
  if (previewValidationWrapper) previewValidationWrapper.style.display = "none";
  if (previewGuideWrapper) previewGuideWrapper.style.display = "none";
  if (previewProposalWrapper) previewProposalWrapper.style.display = "none";

  const tabId = "tab" + tab.charAt(0).toUpperCase() + tab.slice(1);
  const activeTabBtn = document.getElementById(tabId);
  if (activeTabBtn) activeTabBtn.classList.add("active");

  if (tab === "guide") {
    if (previewGuideWrapper) previewGuideWrapper.style.display = "flex";
  } else if (tab === "proposal") {
    if (previewProposalWrapper) previewProposalWrapper.style.display = "flex";
  } else if (tab === "variables") {
    if (previewVariablesWrapper) previewVariablesWrapper.style.display = "flex";
    syncVariableMonitorUI();
  } else if (tab === "validation") {
    if (previewValidationWrapper) previewValidationWrapper.style.display = "flex";
  } else {
    if (previewCodeWrapper) previewCodeWrapper.style.display = "block";
  }
  
  updateCodePreview();
}

function updateSummaryPanel() {
  document.getElementById("summaryPlatform").innerText = state.platform === "ontap" ? `ONTAP ${state.version}` : `StorageGRID ${state.version}`;
  document.getElementById("summarySvmCount").innerText = state.platform === "ontap" ? state.svms.length : state.sgTenants.length;
  document.getElementById("summaryVolCount").innerText = state.platform === "ontap" ? state.volumes.length : state.sgBuckets.length;
  
  const activeProtos = state.protocols || [state.protocol];
  let protoLabel = activeProtos.map(p => {
    let lbl = p.toUpperCase();
    if (lbl === "NVME_TCP") lbl = "NVMe/TCP";
    if (lbl === "NVME_FC") lbl = "NVMe/FC";
    if (lbl === "ONTAP_S3") lbl = "ONTAP S3";
    if (lbl === "STORAGEGRID_S3") lbl = "S3 Bucket";
    return lbl;
  }).join(", ");
  document.getElementById("summaryProtocol").innerText = protoLabel;

  const sumTrident = document.getElementById("summaryTrident");
  if (sumTrident) {
    sumTrident.innerText = state.trident.enabled ? "Active" : "Disabled";
  }

  // Step 7 Review Page update
  document.getElementById("revDeployType").innerText = state.mode === "greenfield" ? "Greenfield Deploy" : "Existing AutoSupport Configuration";
  document.getElementById("revPlatform").innerText = state.platform === "ontap" ? `NetApp ONTAP ${state.version}` : `StorageGRID ${state.version}`;
  document.getElementById("revProtocol").innerText = protoLabel;

  if (state.platform === "ontap") {
    document.getElementById("revResourcesSummary").innerText = `${state.svms.length} SVM(s) / ${state.volumes.length} Volume(s)`;
  } else {
    document.getElementById("revResourcesSummary").innerText = `${state.sgTenants.length} Tenant(s) / ${state.sgBuckets.length} Bucket(s)`;
  }

  let virtText = state.workload.hypervisor === "none" ? "Bare-Metal" : state.workload.hypervisor.toUpperCase();
  let dbText = state.workload.db === "none" ? "General Workload" : state.workload.db.toUpperCase();
  document.getElementById("revWorkload").innerText = `${virtText} / ${dbText}`;

  let swText = "Generic / None";
  if (state.network.switchBrand === "cisco") swText = `Cisco MDS (${state.network.portSpeed} Gb, MTU ${state.network.mtu})`;
  if (state.network.switchBrand === "brocade") swText = `Brocade SAN (${state.network.portSpeed} Gb)`;
  document.getElementById("revSwitch").innerText = swText;

  const reviewSvgContainer = document.getElementById("reviewTopologySvgContainer");
  if (reviewSvgContainer) {
    reviewSvgContainer.innerHTML = generateSvgTopology();
  }

  const reviewCablingCard = document.getElementById("reviewCablingCard");
  if (reviewCablingCard) {
    reviewCablingCard.style.display = state.platform === "ontap" ? "block" : "none";
  }

  const reviewStorageCablingCard = document.getElementById("reviewStorageCablingCard");
  if (reviewStorageCablingCard) {
    reviewStorageCablingCard.style.display = state.platform === "ontap" ? "block" : "none";
  }

  updateCablingPlanner();

  // Update Presales Proposal card key metrics dynamically
  const perf = calculatePerformanceMetrics();
  const proposalEstIops = document.getElementById("proposalEstIops");
  const proposalEstThroughput = document.getElementById("proposalEstThroughput");
  const proposalEstLatency = document.getElementById("proposalEstLatency");
  const proposalEstCapacity = document.getElementById("proposalEstCapacity");
  
  if (proposalEstIops) proposalEstIops.innerText = perf.iops.toLocaleString() + " IOPS";
  if (proposalEstThroughput) proposalEstThroughput.innerText = (perf.throughputMb >= 1000 ? (perf.throughputMb / 1000).toFixed(1) + " GB/s" : perf.throughputMb + " MB/s");
  if (proposalEstLatency) proposalEstLatency.innerText = perf.latencyMs + " ms";
  
  if (proposalEstCapacity) {
    const capGb = state.sizing.logicalGb || state.sizing.usableGb || 0;
    if (capGb >= 1048576) {
      proposalEstCapacity.innerText = (capGb / 1048576).toFixed(1) + " PB";
    } else if (capGb >= 1024) {
      proposalEstCapacity.innerText = (capGb / 1024).toFixed(1) + " TB";
    } else {
      proposalEstCapacity.innerText = capGb + " GB";
    }
  }

  // Auto-save to LocalStorage
  saveToLocalStorage();
}

function resetToDefaults() {
  if (confirm("Are you sure you want to reset all configurator inputs? All manual settings and parsed ASUP details will be lost.")) {
    try {
      localStorage.removeItem("netapp_configurator_state");
    } catch (e) {
      console.warn("LocalStorage clear failed:", e);
    }
    window.location.reload();
  }
}

function saveConfigurationState() {
  const jsonContent = JSON.stringify(state, null, 2);
  safeTriggerDownload("netapp_config.json", jsonContent);
}

async function importConfigurationFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const parsedState = JSON.parse(text);
    
    if (parsedState && (parsedState.platform === "ontap" || parsedState.platform === "storagegrid")) {
      Object.assign(state, parsedState);
      state.mode = "greenfield";
      syncUIWithState();
      
      e.target.value = "";
      alert("Configuration successfully loaded and restored!");
      showStep(1);
    } else {
      throw new Error("Missing platform identifier (ontap or storagegrid).");
    }
  } catch (err) {
    console.error("Failed to parse configuration file:", err);
    alert("Error: Failed to load configuration file. Please verify it is a valid NetApp Configurator JSON state file.\n\nDetails: " + err.message);
    e.target.value = "";
  }
}

function saveToLocalStorage() {
  try {
    localStorage.setItem("netapp_configurator_state", JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state to localStorage:", e);
  }
}

// 10. CODE GENERATORS (LOOPING DYNAMIC ARRAYS)
function generateOntapCliCode() {
  const versionNum = versionToNum(state.version);
  const proto = state.protocol;
  const nodeCount = parseInt(state.sizing.nodeCount) || 2;
  const node1 = state.customNodeNames[0] || "cluster1-01";
  const node2 = state.customNodeNames[1] || "cluster1-02";

  let code = `# =========================================================================\n`;
  code += `# NETAPP ONTAP DEPLOYMENT CLI CONFIGURATION SCRIPT\n`;
  code += `# Generated for version: ONTAP ${state.version}\n`;
  code += `# Deployment Mode: ${state.mode.toUpperCase()}\n`;
  code += `# Resource Count: ${state.svms.length} SVM(s), ${state.volumes.length} Volume(s)\n`;
  code += `# =========================================================================\n\n`;

  if (state.platform === "storagegrid") {
    return generateStoragegridCliCode();
  }

  // 0. Hardware Ports & Aggregates Setup [NEW]
  if (state.mode === "greenfield") {
    code += `# ==================== 0. PHYSICAL HARDWARE & AGGREGATES SETUP ====================\n`;
    code += `# Enable storage interfaces for NS224 NVMe RoCE or SAS shelves\n`;
    const model = state.sizing.controller;
    const shelfType = state.sizing.shelfType;
    const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
    
    let numPairs = Math.max(1, nodeCount / 2);
    let shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
    if (state.metrocluster && state.metrocluster.enabled) {
      const halfNodes = nodeCount / 2;
      const mPairs = Math.max(1, halfNodes / 2);
      shelvesPerPair = Math.max(1, Math.ceil(shelfCount / mPairs));
    }
    
    const sizingInfo = getExpansionCardsAndPorts(model, shelfType, shelvesPerPair);
    const ports = getControllerPorts(model);

    for (let i = 1; i <= nodeCount; i++) {
      const nodeName = state.customNodeNames[i - 1] || `cluster1-0${i}`;
      code += `storage port modify -node ${nodeName} -port ${ports.storage[0]} -mode storage\n`;
      code += `storage port modify -node ${nodeName} -port ${ports.storage[1]} -mode storage\n`;
      sizingInfo.cards.forEach(card => {
        card.ports.forEach(p => {
          code += `storage port modify -node ${nodeName} -port ${p} -mode storage\n`;
        });
      });
    }
    code += `\n`;

    const isAsaR2 = (state.ontapPlatform === "asa" && versionNum >= 916);
    if (isAsaR2) {
      code += `# [ASA r2 Note] Aggregate creation is managed automatically by Storage Availability Zones (SAZ).\n\n`;
    } else {
      code += `# Create physical storage aggregates according to RAID best practices\n`;
      const aggrPrefix = state.sizing.aggrNamePrefix || "aggr_data";
      const halfDiskCount = Math.floor(state.sizing.diskCount / 2);
      const mirrorParam = (state.metrocluster && state.metrocluster.enabled) ? " -mirror true" : "";
      code += `storage aggregate create -aggregate ${aggrPrefix}_1 -node ${node1} -diskcount ${halfDiskCount} -raidtype ${state.sizing.raidType} -raidgroupsize ${state.sizing.raidGroupSize}${mirrorParam}\n`;
      code += `storage aggregate create -aggregate ${aggrPrefix}_2 -node ${node2} -diskcount ${halfDiskCount} -raidtype ${state.sizing.raidType} -raidgroupsize ${state.sizing.raidGroupSize}${mirrorParam}\n`;
      code += `\n`;
    }
  }

  // 1. SVM Creation Loop
  code += `# ==================== 1. STORAGE VIRTUAL MACHINE CONFIG ====================\n`;
  state.svms.forEach(svm => {
    if (state.mode === "greenfield" || !svm.fromAsup) {
      const modeStr = svm.fromAsup ? "" : " [Manually Added]";
      code += `# Create new SVM${modeStr}\n`;
      code += `vserver create -vserver ${svm.name} -subtype default -ipspace Default\n`;
      let allowedProtos = proto === "ontap_s3" ? "s3" : proto;
      if (proto === "nvme_tcp" || proto === "nvme_fc") allowedProtos = "nvme";
      if (proto === "fc" || proto === "fcoe") allowedProtos = "fcp";
      code += `vserver modify -vserver ${svm.name} -protocols ${allowedProtos}\n`;
      
      if (versionNum >= 917) {
        code += `security login role create -role jit_admin -command "volume" -access all -vserver ${svm.name}\n`;
        code += `security login modify -username admin -role admin -privilege-elevation enabled -vserver ${svm.name}\n`;
      }
      code += `\n`;
    } else {
      code += `# [ASUP Existing] SVM ${svm.name} already exists. Skipping creation.\n`;
    }
  });

  // Enable key manager if encryption is required anywhere
  const needsEncryption = state.volumes.some(v => v.encryption);
  if (needsEncryption && state.mode === "greenfield") {
    code += `# Enable Onboard Key Manager for Cryptographic NVE Volumes Encryption\n`;
    code += `# security key-manager onboard enable\n\n`;
  }

  // 2. Data Interface LIFs Configuration Loop
  code += `# ==================== 2. LOGICAL NETWORK INTERFACES (LIFs) ====================\n`;
  const vlanStr = state.network.vlanId ? `-${state.network.vlanId}` : "";
  const isLegacyNet = versionNum < 908;
  const policyNas = isLegacyNet ? "-role data -data-protocol nfs" : "-service-policy default-data-files";
  const policySmb = isLegacyNet ? "-role data -data-protocol cifs" : "-service-policy default-data-files";
  const policyIscsi = isLegacyNet ? "-role data -data-protocol iscsi" : "-service-policy default-data-blocks";
  const policyFc = isLegacyNet ? "-role data -data-protocol fcp" : "-service-policy default-data-blocks";
  const policyFcoe = isLegacyNet ? "-role data -data-protocol fcp" : "-service-policy default-data-blocks";
  const policyNvmeTcp = isLegacyNet ? "-role data -data-protocol nvme-tcp" : "-service-policy default-data-blocks";
  const policyNvmeFc = isLegacyNet ? "-role data -data-protocol nvme-fc" : "-service-policy default-data-blocks";
  const policyS3 = isLegacyNet ? "-role data -data-protocol S3" : "-service-policy default-data-files";

  state.svms.forEach(svm => {
    // Generate distinct IP address interfaces for each SVM
    const ipBase = svm.dataIp;
    const ipParts = ipBase.split(".");
    let ip1 = ipBase;
    let ip2 = ipBase;
    if (ipParts.length === 4) {
      ip1 = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${ipParts[3]}`;
      ip2 = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${Number(ipParts[3]) + 10}`; // Shift IP for target 2
    }

    code += `# Data Interfaces for SVM: ${svm.name}\n`;
    if (proto === "nfs") {
      code += `network interface create -vserver ${svm.name} -lif lif_nfs_${svm.name}_1 ${policyNas} -home-node ${node1} -home-port e0d${vlanStr} -address ${ip1} -netmask 255.255.255.0\n`;
      code += `network interface create -vserver ${svm.name} -lif lif_nfs_${svm.name}_2 ${policyNas} -home-node ${node2} -home-port e0d${vlanStr} -address ${ip2} -netmask 255.255.255.0\n`;
    } else if (proto === "smb") {
      code += `network interface create -vserver ${svm.name} -lif lif_smb_${svm.name}_1 ${policySmb} -home-node ${node1} -home-port e0d${vlanStr} -address ${ip1} -netmask 255.255.255.0\n`;
      code += `network interface create -vserver ${svm.name} -lif lif_smb_${svm.name}_2 ${policySmb} -home-node ${node2} -home-port e0d${vlanStr} -address ${ip2} -netmask 255.255.255.0\n`;
    } else if (proto === "iscsi") {
      code += `network interface create -vserver ${svm.name} -lif lif_iscsi_${svm.name}_1 ${policyIscsi} -home-node ${node1} -home-port e0a${vlanStr} -address ${ip1} -netmask 255.255.255.0\n`;
      code += `network interface create -vserver ${svm.name} -lif lif_iscsi_${svm.name}_2 ${policyIscsi} -home-node ${node2} -home-port e0b${vlanStr} -address ${ip2} -netmask 255.255.255.0\n`;
    } else if (proto === "fc" || proto === "fcoe") {
      const activePolicy = proto === "fc" ? policyFc : policyFcoe;
      code += `network interface create -vserver ${svm.name} -lif lif_fc_${svm.name}_1 ${activePolicy} -home-node ${node1} -home-port 0a -data-protocol fcp\n`;
      code += `network interface create -vserver ${svm.name} -lif lif_fc_${svm.name}_2 ${activePolicy} -home-node ${node2} -home-port 0b -data-protocol fcp\n`;
    } else if (proto === "nvme_tcp") {
      code += `network interface create -vserver ${svm.name} -lif lif_nvme_tcp_${svm.name}_1 ${policyNvmeTcp} -home-node ${node1} -home-port e0f${vlanStr} -address ${ip1} -netmask 255.255.252.0 -data-protocol nvme-tcp\n`;
      code += `network interface create -vserver ${svm.name} -lif lif_nvme_tcp_${svm.name}_2 ${policyNvmeTcp} -home-node ${node2} -home-port e0f${vlanStr} -address ${ip2} -netmask 255.255.252.0 -data-protocol nvme-tcp\n`;
    } else if (proto === "nvme_fc") {
      code += `network interface create -vserver ${svm.name} -lif lif_nvme_fc_${svm.name}_1 ${policyNvmeFc} -home-node ${node1} -home-port 1a -data-protocol nvme-fc\n`;
      code += `network interface create -vserver ${svm.name} -lif lif_nvme_fc_${svm.name}_2 ${policyNvmeFc} -home-node ${node2} -home-port 1b -data-protocol nvme-fc\n`;
    } else if (proto === "ontap_s3") {
      code += `network interface create -vserver ${svm.name} -lif lif_s3_${svm.name}_1 ${policyS3} -home-node ${node1} -home-port e0e -address ${ip1} -netmask 255.255.252.0\n`;
    }
    code += `\n`;
  });

  // FabricPool Object Store configuration
  if (state.ontapFabricPool.enabled) {
    const provider = state.ontapFabricPool.providerType || "SG";
    code += `# ==================== FABRICPOOL CLOUD TIERING TARGET ====================\n`;
    code += `# -------------------------------------------------------------------------\n`;
    code += `# CONFIGURATION CONSIDERATIONS & PRE-REQUISITES:\n`;
    code += `# -------------------------------------------------------------------------\n`;
    code += `# DESTINATION (${provider} Object Store) Requirements:\n`;
    code += `#   1. Create S3 Tenant Account and S3 group/user.\n`;
    code += `#   2. Generate access keys (Access Key ID & Secret Access Key).\n`;
    code += `#   3. Create the S3 Bucket/Container: "${state.ontapFabricPool.bucket}"\n`;
    code += `#      - [Best Practice] Disable bucket versioning and bucket lifecycle rules.\n`;
    code += `#        FabricPool manages its own object lifecycles; versioning causes bloat.\n`;
    code += `#   4. Configure networking (firewalls, HA groups, and Load Balancer endpoints)\n`;
    code += `#      to permit incoming SSL traffic from ONTAP controllers on port ${state.ontapFabricPool.port}.\n`;
    code += `# \n`;
    code += `# SOURCE (NetApp ONTAP Cluster) Requirements:\n`;
    code += `#   1. Ensure ONTAP node management / data ports can reach and resolve DNS for:\n`;
    code += `#      ${state.ontapFabricPool.endpoint}\n`;
    code += `#      Verify via: dns show\n`;
    if (state.ontapFabricPool.sslEnabled) {
      code += `#   2. Install the destination's ROOT / CA SSL certificate to establish trust:\n`;
      code += `#      Run the certificate installation command below and paste the CA PEM block.\n`;
    }
    code += `# -------------------------------------------------------------------------\n\n`;

    if (state.ontapFabricPool.sslEnabled) {
      const caName = state.ontapFabricPool.caCertName || "FabricPool_CA";
      code += `# Install CA certificate to authorize SSL trust for object storage target\n`;
      code += `security certificate install -type server-ca -vserver admin -ca-name ${caName}\n`;
      if (state.ontapFabricPool.caCertPem) {
        const pemLines = state.ontapFabricPool.caCertPem.trim().split("\n").map(l => `#   ${l}`).join("\n");
        code += `# Paste the following CA PEM certificate when prompted:\n${pemLines}\n`;
      } else {
        code += `# [Paste the CA PEM certificate when prompted]\n`;
      }
      code += `\n`;
    }

    code += `# Configure the cloud tier target on the ONTAP cluster\n`;
    const sslStr = state.ontapFabricPool.sslEnabled ? "true" : "false";
    code += `object-store config create -object-store-name sg_fabricpool_target -provider-type ${provider} -server ${state.ontapFabricPool.endpoint} -port ${state.ontapFabricPool.port} -container ${state.ontapFabricPool.bucket} -access-key ${state.ontapFabricPool.accessKey} -secret-key ${state.ontapFabricPool.secretKey} -ssl-enabled ${sslStr}\n\n`;

    // Gather unique aggregates from volumes with tiering policy !== "none"
    const tieredAggrs = [];
    state.volumes.forEach(vol => {
      if (vol.fabricpool && vol.fabricpool !== "none") {
        if (!tieredAggrs.includes(vol.aggregate)) {
          tieredAggrs.push(vol.aggregate);
        }
      }
    });

    if (tieredAggrs.length > 0) {
      code += `# Attach cloud tier to performance aggregates\n`;
      tieredAggrs.forEach(aggr => {
        code += `storage aggregate object-store attach -aggregate ${aggr} -object-store-name sg_fabricpool_target\n`;
      });
      code += `\n`;
    }
  }

  // 3. Volume & LUN Creation loop
  code += `# ==================== 3. VOLUME & STORAGE EFFICIENCY CONFIG ====================\n`;
  const isAsaR2 = (state.ontapPlatform === "asa" && versionNum >= 916);
  if (isAsaR2) {
    code += `# [ASA r2 Note] Volumes are automatically provisioned when LUNs/Namespaces are created.\n\n`;
  } else {
    state.volumes.forEach((vol, idx) => {
      const sizeStr = `${vol.size}${vol.sizeUnit}`;
      const isSan = vol.type === "san" || (vol.luns && vol.luns.length > 0);
      const activeProtos = state.protocols || [state.protocol || "nfs"];
      const isNasActive = activeProtos.some(p => p === "nfs" || p === "smb");
      const junctionPathStr = (isSan || !isNasActive) ? "" : ` -junction-path /${vol.name}`;
      const encryptStr = vol.encryption ? " -encrypt true" : "";
      const aggrName = state.mode === "greenfield" ? ((state.sizing.aggrNamePrefix || "aggr_data") + "_" + (idx % 2 === 0 ? "1" : "2")) : vol.aggregate;
      const spaceGuaranteeStr = isSan ? " -space-guarantee none" : "";
      
      if (state.mode === "greenfield" || !vol.fromAsup) {
        const modeStr = vol.fromAsup ? "" : " [Manually Added]";
        code += `# Volume: ${vol.name} (SVM Owner: ${vol.svmName})${modeStr}\n`;
        code += `volume create -vserver ${vol.svmName} -volume ${vol.name} -aggregate ${aggrName} -size ${sizeStr} -state online -policy default -security-style unix${spaceGuaranteeStr}${junctionPathStr}${encryptStr}\n`;
        
        // Efficiency
        code += `volume efficiency modify -vserver ${vol.svmName} -volume ${vol.name} -compression true -inline-compression true -inline-dedupe true\n`;
        code += `volume efficiency on -vserver ${vol.svmName} -volume ${vol.name}\n`;
        
        // ARP Ransomware
        if (versionNum >= 910) {
          if (versionNum >= 918) {
            code += `# (ARP is auto-enabled on ONTAP 9.18+. Verifying/applying monitor settings)\n`;
          }
          code += `volume anti-ransomware enable -vserver ${vol.svmName} -volume ${vol.name} -mode dry-run\n`;
        }

        // FabricPool Tiering
        if (vol.fabricpool && vol.fabricpool !== "none" && vol.fabricpool !== "false" && vol.fabricpool !== false) {
          const policyVal = vol.fabricpool === true ? "auto" : vol.fabricpool;
          let coolingStr = "";
          if ((policyVal === "auto" || policyVal === "snapshot-only") && vol.coolingDays && vol.coolingDays !== 31) {
            coolingStr = ` -tiering-minimum-cooling-days ${vol.coolingDays}`;
          }
          code += `volume modify -vserver ${vol.svmName} -volume ${vol.name} -tiering-policy ${policyVal}${coolingStr}\n`;
        }
        
        // Create LUNs / Namespaces if manually added SAN volume
        if (isSan && vol.luns && vol.luns.length > 0) {
          const isNvme = activeProtos.some(p => p.startsWith("nvme"));
          vol.luns.forEach(lun => {
            const path = `/vol/${vol.name}/${lun.name}`;
            if (lun.name.startsWith("ns_") || isNvme) {
              code += `vserver nvme namespace create -vserver ${vol.svmName} -path ${path} -size ${lun.size}${lun.sizeUnit} -ostype ${lun.osType}\n`;
            } else {
              code += `lun create -vserver ${vol.svmName} -path ${path} -size ${lun.size}${lun.sizeUnit} -ostype ${lun.osType} -space-reserve disabled\n`;
            }
          });
        }
        code += `\n`;
      } else {
        // Existing Volume based on ASUP
        let modified = false;
        let volModCode = "";
        
        if (vol.size !== vol.originalSize) {
          volModCode += `volume size -vserver ${vol.svmName} -volume ${vol.name} -new-size ${vol.size}${vol.sizeUnit}\n`;
          modified = true;
        }
        
        if (vol.fabricpool && vol.fabricpool !== "none" && vol.fabricpool !== "false" && vol.fabricpool !== false) {
          const policyVal = vol.fabricpool === true ? "auto" : vol.fabricpool;
          let coolingStr = "";
          if ((policyVal === "auto" || policyVal === "snapshot-only") && vol.coolingDays && vol.coolingDays !== 31) {
            coolingStr = ` -tiering-minimum-cooling-days ${vol.coolingDays}`;
          }
          volModCode += `volume modify -vserver ${vol.svmName} -volume ${vol.name} -tiering-policy ${policyVal}${coolingStr}\n`;
          modified = true;
        }
        
        if (modified) {
          code += `# [ASUP Modified] Volume ${vol.name} modified\n`;
          code += volModCode;
        } else {
          code += `# [ASUP Existing] Volume: ${vol.name} (SVM: ${vol.svmName}, Aggregate: ${vol.aggregate}, Size: ${vol.size}${vol.sizeUnit}) already exists. Verification complete.\n`;
        }
        
        // Process nested LUNs (either existing or new)
        if (isSan && vol.luns && vol.luns.length > 0) {
          const isNvme = activeProtos.some(p => p.startsWith("nvme"));
          vol.luns.forEach(lun => {
            const path = `/vol/${vol.name}/${lun.name}`;
            if (!lun.fromAsup) {
              // Create manually added LUN in existing volume
              if (lun.name.startsWith("ns_") || isNvme) {
                code += `vserver nvme namespace create -vserver ${vol.svmName} -path ${path} -size ${lun.size}${lun.sizeUnit} -ostype ${lun.osType}\n`;
              } else {
                code += `lun create -vserver ${vol.svmName} -path ${path} -size ${lun.size}${lun.sizeUnit} -ostype ${lun.osType} -space-reserve disabled\n`;
              }
            } else if (lun.size !== lun.originalSize) {
              // Resize existing LUN
              if (lun.name.startsWith("ns_") || isNvme) {
                code += `vserver nvme namespace resize -vserver ${vol.svmName} -path ${path} -size ${lun.size}${lun.sizeUnit}\n`;
              } else {
                code += `lun resize -vserver ${vol.svmName} -path ${path} -size ${lun.size}${lun.sizeUnit}\n`;
              }
            } else {
              code += `# [ASUP Existing] LUN: ${lun.name} (Path: ${path}, Size: ${lun.size}${lun.sizeUnit}) already exists. Verification complete.\n`;
            }
          });
        }
        code += `\n`;
      }
    });
  }

  // 3.1 Quality of Service (QoS) & Throttling [NEW]
  if (state.qos.policyType !== "none") {
    code += `# ==================== 3.1 QUALITY OF SERVICE (QoS) CONFIG ====================\n`;
    state.svms.forEach(svm => {
      const policyName = `qos_${svm.name}_policy`;
      if (state.qos.policyType === "shared" || state.qos.policyType === "non_shared") {
        const isSharedStr = state.qos.policyType === "shared" ? " -is-shared true" : " -is-shared false";
        const maxStr = ` -max-throughput ${state.qos.peakIops}iops,${state.qos.peakThroughput}mb/s`;
        const minStr = state.qos.expectedIops > 0 ? ` -min-throughput ${state.qos.expectedIops}iops` : "";
        code += `qos policy-group create -policy-group ${policyName} -vserver ${svm.name}${maxStr}${minStr}${isSharedStr}\n`;
        
        if (!isAsaR2) {
          // Apply QoS policy to all volumes under this SVM
          state.volumes.filter(v => v.svmName === svm.name).forEach(vol => {
            code += `volume modify -vserver ${svm.name} -volume ${vol.name} -policy-group ${policyName}\n`;
          });
        }
      } else if (state.qos.policyType === "adaptive") {
        const expectedIops = state.qos.allocatedIops;
        const peakIops = state.qos.peakIopsPerTb;
        const absMin = state.qos.absoluteMinIops;
        code += `qos adaptive-policy-group create -policy-group ${policyName} -vserver ${svm.name} -expected-iops ${expectedIops}iops/TB -peak-iops ${peakIops}iops/TB -absolute-min-iops ${absMin}iops\n`;
        
        if (!isAsaR2) {
          // Apply Adaptive QoS policy to all volumes under this SVM
          state.volumes.filter(v => v.svmName === svm.name).forEach(vol => {
            code += `volume modify -vserver ${svm.name} -volume ${vol.name} -adaptive-policy-group ${policyName}\n`;
          });
        }
      }
    });
    code += `\n`;
  }

  // 4. Protocol Specific Configurations
  code += `# ==================== 4. PROTOCOL INTERFACES & EXPORTS ====================\n`;
  
  // 4. Protocol Specific Configurations
  code += `# ==================== 4. PROTOCOL INTERFACES & EXPORTS ====================\n`;
  
  const activeProtos = state.protocols || [state.protocol];
  
  activeProtos.forEach(p => {
    if (p === "nfs") {
      const nfsConf = state.protocolData.nfs;
      state.svms.forEach(svm => {
        code += `# Export Policy mapping for ${svm.name}\n`;
        code += `vserver export-policy create -vserver ${svm.name} -policyname ${nfsConf.exportPolicy}\n`;
        let rules = nfsConf.accessLevel === "ro" ? "-rorule any -rwrule none" : "-rorule any -rwrule any";
        if (nfsConf.accessLevel === "rw") rules += " -superuser any";
        code += `vserver export-policy rule create -vserver ${svm.name} -policyname ${nfsConf.exportPolicy} -clientmatch ${nfsConf.clientMatch} -ruleindex 1 -protocol nfs3,nfs4 ${rules}\n`;
        
        // Bind volumes of this SVM to policy
        state.volumes.filter(v => v.svmName === svm.name).forEach(vol => {
          code += `volume modify -vserver ${svm.name} -volume ${vol.name} -policy ${nfsConf.exportPolicy}\n`;
        });
        code += `\n`;
      });
    } 
    if (p === "smb") {
      const smbConf = state.protocolData.smb;
      state.svms.forEach(svm => {
        code += `# CIFS Server Active Directory Joining for ${svm.name}\n`;
        code += `vserver cifs create -vserver ${svm.name} -cifs-server ${svm.name.substring(0, 15)} -domain ${smbConf.adDomain} -ou "OU=NetApp,DC=corp,DC=internal"\n`;
        
        // Create shares for each volume
        state.volumes.filter(v => v.svmName === svm.name).forEach(vol => {
          code += `vserver cifs share create -vserver ${svm.name} -share-name share_${vol.name} -path /${vol.name} -share-properties oplocks,browsable\n`;
          let perm = smbConf.permissions === "full_control" ? "Full Control" : (smbConf.permissions === "change" ? "Change" : "Read");
          code += `vserver cifs share access-control create -vserver ${svm.name} -share share_${vol.name} -user-or-group Everyone -permission ${perm}\n`;
        });
        code += `\n`;
      });
    }
    if (p === "iscsi") {
      const iscsiConf = state.protocolData.iscsi;
      state.svms.forEach(svm => {
        if (isAsaR2) {
          code += `# [ASA r2] iSCSI Subsystem and Storage Unit configuration for ${svm.name}\n`;
          code += `storage-unit subsystem create -vserver ${svm.name} -subsystem sub_${svm.name} -protocols iscsi -ostype vmware\n`;
          code += `storage-unit subsystem host add -vserver ${svm.name} -subsystem sub_${svm.name} -hosts ${iscsiConf.initiatorIqn}\n`;
          
          state.volumes.filter(v => v.svmName === svm.name && (v.type === "san" || (v.luns && v.luns.length > 0))).forEach(vol => {
            if (!vol.luns || vol.luns.length === 0) {
              vol.luns = [{ id: 1, name: `lun_${vol.name}_1`, size: vol.size, sizeUnit: vol.sizeUnit, osType: "vmware" }];
            }
            vol.luns.forEach(lun => {
              code += `storage-unit create -vserver ${svm.name} -storage-unit ${lun.name} -size ${lun.size}${lun.sizeUnit} -subsystem sub_${svm.name}\n`;
            });
          });
        } else {
          code += `# iSCSI Service configurations for ${svm.name}\n`;
          code += `vserver iscsi create -vserver ${svm.name} -target-alias ${svm.name}\n`;
          code += `vserver iscsi start -vserver ${svm.name}\n`;
          
          code += `igroup create -vserver ${svm.name} -igroup ig_${svm.name} -protocol iscsi -ostype vmware -initiator ${iscsiConf.initiatorIqn}\n`;
          
          if (iscsiConf.chapEnable) {
            code += `vserver iscsi security create -vserver ${svm.name} -initiator ${iscsiConf.initiatorIqn} -auth-type CHAP -user-name ${iscsiConf.chapUser} -outbound-user-name ${iscsiConf.chapUser}\n`;
          }
          
          // Map LUNs for each volume
          state.volumes.filter(v => v.svmName === svm.name && (v.type === "san" || (v.luns && v.luns.length > 0))).forEach(vol => {
            if (!vol.luns || vol.luns.length === 0) {
              vol.luns = [{ id: 1, name: `lun_${vol.name}_1`, size: vol.size, sizeUnit: vol.sizeUnit, osType: "vmware" }];
            }
            vol.luns.forEach(lun => {
              if (!lun.name.startsWith("ns_")) {
                const path = `/vol/${vol.name}/${lun.name}`;
                code += `lun map -vserver ${svm.name} -path ${path} -igroup ig_${svm.name}\n`;
              }
            });
          });
        }
        code += `\n`;
      });
    }
    if (p === "fc" || p === "fcoe") {
      const fcConf = p === "fc" ? state.protocolData.fc : state.protocolData.fcoe;
      state.svms.forEach(svm => {
        if (isAsaR2) {
          code += `# [ASA r2] FCP Subsystem and Storage Unit configuration for ${svm.name}\n`;
          code += `storage-unit subsystem create -vserver ${svm.name} -subsystem sub_${svm.name} -protocols fcp -ostype vmware\n`;
          const wwpns = fcConf.initiatorWwpn.split(",").map(w => w.trim());
          wwpns.forEach(w => {
            if (w) code += `storage-unit subsystem host add -vserver ${svm.name} -subsystem sub_${svm.name} -hosts ${w}\n`;
          });
          
          state.volumes.filter(v => v.svmName === svm.name && (v.type === "san" || (v.luns && v.luns.length > 0))).forEach(vol => {
            if (!vol.luns || vol.luns.length === 0) {
              vol.luns = [{ id: 1, name: `lun_${vol.name}_1`, size: vol.size, sizeUnit: vol.sizeUnit, osType: "vmware" }];
            }
            vol.luns.forEach(lun => {
              code += `storage-unit create -vserver ${svm.name} -storage-unit ${lun.name} -size ${lun.size}${lun.sizeUnit} -subsystem sub_${svm.name}\n`;
            });
          });
        } else {
          code += `# Fibre Channel FCP Service Setup for ${svm.name}\n`;
          code += `vserver fcp create -vserver ${svm.name} -status-admin up\n`;
          
          code += `igroup create -vserver ${svm.name} -igroup ${fcConf.igroupName}_${svm.name} -protocol fcp -ostype vmware\n`;
          
          const wwpns = fcConf.initiatorWwpn.split(",").map(w => w.trim());
          wwpns.forEach(w => {
            if (w) code += `igroup add -vserver ${svm.name} -igroup ${fcConf.igroupName}_${svm.name} -initiator ${w}\n`;
          });
          
          // Map LUNs for each volume
          state.volumes.filter(v => v.svmName === svm.name && (v.type === "san" || (v.luns && v.luns.length > 0))).forEach(vol => {
            if (!vol.luns || vol.luns.length === 0) {
              vol.luns = [{ id: 1, name: `lun_${vol.name}_1`, size: vol.size, sizeUnit: vol.sizeUnit, osType: "vmware" }];
            }
            vol.luns.forEach(lun => {
              if (!lun.name.startsWith("ns_")) {
                const path = `/vol/${vol.name}/${lun.name}`;
                code += `lun map -vserver ${svm.name} -path ${path} -igroup ${fcConf.igroupName}_${svm.name}\n`;
              }
            });
          });
        }
        code += `\n`;
      });
    }
    if (p === "nvme_tcp" || p === "nvme_fc") {
      const nvmeConf = p === "nvme_tcp" ? state.protocolData.nvme_tcp : state.protocolData.nvme_fc;
      state.svms.forEach(svm => {
        if (isAsaR2) {
          code += `# [ASA r2] NVMe Subsystem and Storage Unit configuration for ${svm.name}\n`;
          code += `storage-unit subsystem create -vserver ${svm.name} -subsystem sub_${svm.name} -protocols nvme -ostype linux\n`;
          code += `storage-unit subsystem host add -vserver ${svm.name} -subsystem sub_${svm.name} -hosts ${nvmeConf.hostNqn}\n`;
          
          state.volumes.filter(v => v.svmName === svm.name && (v.type === "san" || (v.luns && v.luns.length > 0))).forEach(vol => {
            if (!vol.luns || vol.luns.length === 0) {
              vol.luns = [{ id: 1, name: `ns_${vol.name}_1`, size: vol.size, sizeUnit: vol.sizeUnit, osType: "linux" }];
            }
            vol.luns.forEach(lun => {
              code += `storage-unit create -vserver ${svm.name} -storage-unit ${lun.name} -size ${lun.size}${lun.sizeUnit} -subsystem sub_${svm.name}\n`;
            });
          });
        } else {
          code += `# NVMe configurations for SVM: ${svm.name}\n`;
          code += `vserver nvme create -vserver ${svm.name}\n`;
          code += `vserver nvme subsystem create -vserver ${svm.name} -subsystem ${nvmeConf.subsystem}_${svm.name} -ostype linux\n`;
          
          let tlsOpt = (p === "nvme_tcp" && versionNum >= 916) ? " -key-type psk" : "";
          code += `vserver nvme subsystem host add -vserver ${svm.name} -subsystem ${nvmeConf.subsystem}_${svm.name} -host-nqn ${nvmeConf.hostNqn}${tlsOpt}\n`;
  
          // Map Namespaces for each volume
          state.volumes.filter(v => v.svmName === svm.name && (v.type === "san" || (v.luns && v.luns.length > 0))).forEach(vol => {
            if (!vol.luns || vol.luns.length === 0) {
              vol.luns = [{ id: 1, name: `ns_${vol.name}_1`, size: vol.size, sizeUnit: vol.sizeUnit, osType: "linux" }];
            }
            vol.luns.forEach(lun => {
              if (lun.name.startsWith("ns_")) {
                const path = `/vol/${vol.name}/${lun.name}`;
                code += `vserver nvme subsystem map add -vserver ${svm.name} -subsystem ${nvmeConf.subsystem}_${svm.name} -path ${path}\n`;
              }
            });
          });
        }
        code += `\n`;
      });
    }
    if (p === "ontap_s3") {
      const s3Conf = state.protocolData.ontap_s3;
      state.svms.forEach(svm => {
        code += `# Local Object-Store buckets setup for ${svm.name}\n`;
        const secureStr = s3Conf.ssl ? "-is-https-enabled true" : "-is-http-enabled true -is-https-enabled false";
        code += `vserver object-store-server create -vserver ${svm.name} -object-store-server ${svm.name}_s3 -comment "Local Object Store" ${secureStr}\n`;
        code += `vserver object-store-server user create -vserver ${svm.name} -user s3_admin -comment "Local S3 User"\n`;
        code += `vserver object-store-server bucket create -vserver ${svm.name} -bucket ${s3Conf.bucket} -comment "Storage Bucket"\n`;
        if (versionNum >= 916) {
          code += `vserver object-store-server bucket modify -vserver ${svm.name} -bucket ${s3Conf.bucket} -cors-rules "Rules definition"\n`;
        }
        code += `\n`;
      });
    }
  });

  if (state.ontapFabricPool.enabled) {
    code += `\n# =========================================================================\n`;
    code += `# APPENDIX: STORAGEGRID CLOUD TIER PREPARATION COMMANDS\n`;
    code += `# Run these on StorageGRID Grid Manager/Tenant Portal to prepare the target S3 bucket:\n`;
    code += `# 1. Create S3 Tenant Account on StorageGRID Grid Manager:\n`;
    code += `#    curl -X POST "https://grid-manager.company.com/api/v4/grid/accounts" -d '{"name": "FabricPool-Tenant", "protocol": "s3", "policy": {"allowPlatformServices": true}}'\n`;
    code += `# 2. Create S3 Bucket on S3 gateway endpoint:\n`;
    code += `#    export AWS_ACCESS_KEY_ID=SG_FP_ACCESS_KEY_XYZ\n`;
    code += `#    export AWS_SECRET_ACCESS_KEY=SG_FP_SecretKey_12345abcdef\n`;
    code += `#    aws s3api create-bucket --bucket ${state.ontapFabricPool.bucket} --endpoint-url https://${state.ontapFabricPool.endpoint}:${state.ontapFabricPool.port}\n`;
    code += `# =========================================================================\n`;
  }

  if (state.metrocluster && state.metrocluster.enabled) {
    const mcc = state.metrocluster;
    code += `\n# ==================== 8. METROCLUSTER DR SETUP ====================\n`;
    code += `# Configure MetroCluster ${mcc.type.toUpperCase()} Synchronous Replication\n`;
    code += `# Distance: ${mcc.distance} km | Latency: ${mcc.latency} ms RTT\n\n`;
    
    if (mcc.type === "ip") {
      code += `# 1. Configure MetroCluster IP interfaces on Node 1\n`;
      code += `metrocluster configuration-settings interface create -cluster-name cluster_A -node ${node1} -adapter e0a -ip-address 192.168.200.11 -netmask 255.255.255.0 -gateway 192.168.200.1\n`;
      code += `metrocluster configuration-settings interface create -cluster-name cluster_A -node ${node1} -adapter e0b -ip-address 192.168.200.12 -netmask 255.255.255.0 -gateway 192.168.200.1\n\n`;
      
      code += `# 2. Configure MetroCluster IP interfaces on Node 2\n`;
      code += `metrocluster configuration-settings interface create -cluster-name cluster_A -node ${node2} -adapter e0a -ip-address 192.168.200.13 -netmask 255.255.255.0 -gateway 192.168.200.1\n`;
      code += `metrocluster configuration-settings interface create -cluster-name cluster_A -node ${node2} -adapter e0b -ip-address 192.168.200.14 -netmask 255.255.255.0 -gateway 192.168.200.1\n\n`;
      
      code += `# 3. Join the nodes and establish MetroCluster IP peering\n`;
      code += `metrocluster configure -node-name ${node1} -peer-ip-address 192.168.201.11\n\n`;
    } else {
      code += `# 1. Establish Cluster Peering over FC transport\n`;
      code += `cluster peer create -peer-addrs 192.168.21.10 -username admin\n\n`;
      
      code += `# 2. Configure MetroCluster Fabric Control Switches and zoning (Brocade Fabric OS)\n`;
      code += `# (Run Brocade Fabric zoning script first, then execute setup)\n`;
      code += `metrocluster configure\n\n`;
    }
    
    if (mcc.mediator === "mediator") {
      code += `# 4. Add centralized Linux-based ONTAP Mediator for automatic unplanned switchover (AUSO)\n`;
      code += `metrocluster configuration-settings mediator add -mediator-address 192.168.220.10 -peer-cluster cluster_B -user admin\n\n`;
    } else if (mcc.mediator === "tiebreaker") {
      code += `# 4. Configure Java-based MetroCluster Tiebreaker software at Site C\n`;
      code += `# (Add monitoring command from external Tiebreaker host CLI):\n`;
      code += `# tiebreaker monitor add -address 192.168.20.21 -username admin -password admin_pass\n\n`;
    } else {
      code += `# 4. No Mediator configured. Ensure manual switchover procedures are documented.\n\n`;
    }
    
    code += `# 5. Perform MetroCluster deployment validation checks\n`;
    code += `metrocluster check run\n`;
    code += `metrocluster check show\n`;
  }

  return code;
}

function generateStoragegridCliCode() {
  const versionNum = versionToNum(state.version);
  const apiVer = versionNum >= 119 ? "v4" : "v3";

  // Integrations state values
  const identityFed = state.sgIntegrations.identityFederation;
  const kmsProvider = state.sgIntegrations.kmsProvider;
  const ilmPolicy = state.sgIntegrations.ilmPolicy;
  const tlsComp = state.sgIntegrations.tlsCompliance;

  let code = `# =========================================================================\n`;
  code += `# NETAPP STORAGEGRID END-TO-END AUTOMATION CONFIGURATION SCRIPT\n`;
  code += `# Target Platform: StorageGRID Webscale Engine v${state.version} (${apiVer} API)\n`;
  code += `# =========================================================================\n\n`;

  // 1. Grid HA Group & Load Balancer Endpoint Configuration
  const haGroupName = state.sgIntegrations.haGroupName || "ha-gateway-group";
  const haVip = state.sgIntegrations.haVip || "192.168.10.50";
  const haMembers = state.sgIntegrations.haMembers || "sg-gateway-01, sg-gateway-02";
  const lbEndpointName = state.sgIntegrations.lbEndpointName || "s3-load-balancer";
  const lbPort = state.sgIntegrations.lbPort || 10443;
  const lbProtocol = state.sgIntegrations.lbProtocol || "https";

  code += `# 1. GRID ADMIN: Configure High Availability (HA) Group\n`;
  code += `# Creates virtual IP ${haVip} bound to member gateway nodes\n`;
  code += `curl -X POST "https://grid-manager.company.com/api/${apiVer}/grid/ha-groups" \\\n`;
  code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
  code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
  code += `  -d '{\n`;
  code += `    "name": "${haGroupName}",\n`;
  code += `    "description": "High Availability group for S3 client traffic",\n`;
  code += `    "virtualIpAddresses": ["${haVip}"],\n`;
  code += `    "interfaces": [\n`;
  const members = haMembers.split(",");
  members.forEach((member, i) => {
    code += `      {"node": "${member.trim()}", "interface": "eth0"}${i < members.length - 1 ? "," : ""}\n`;
  });
  code += `    ]\n`;
  code += `  }'\n\n`;

  code += `# 2. GRID ADMIN: Configure Load Balancer Endpoint (LBE)\n`;
  code += `# Opens port ${lbPort} bound to HA group for secure S3 traffic\n`;
  code += `curl -X POST "https://grid-manager.company.com/api/${apiVer}/grid/load-balancer-endpoints" \\\n`;
  code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
  code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
  code += `  -d '{\n`;
  code += `    "displayName": "${lbEndpointName}",\n`;
  code += `    "port": ${lbPort},\n`;
  code += `    "protocol": "${lbProtocol.toUpperCase()}",\n`;
  code += `    "bindingMode": "ha-groups",\n`;
  code += `    "haGroups": ["$HA_GROUP_ID"]\n`;
  code += `  }'\n\n`;

  // 2. Identity Federation
  if (identityFed !== "none") {
    code += `# 3. GRID ADMIN: Configure Tenant Identity Federation (${identityFed.toUpperCase()})\n`;
    code += `curl -X PUT "https://grid-manager.company.com/api/${apiVer}/grid/identity-federation" \\\n`;
    code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
    code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
    code += `  -d '{\n`;
    code += `    "type": "${identityFed}",\n`;
    code += `    "isEnabled": true,\n`;
    code += `    "ldapService": {\n`;
    code += `      "uri": "ldaps://ldap.company.com:636",\n`;
    code += `      "bindDn": "cn=storagegrid,ou=services,dc=company,dc=com",\n`;
    code += `      "bindPassword": "BindPasswordSecure123",\n`;
    code += `      "userSearchBase": "ou=users,dc=company,dc=com",\n`;
    code += `      "groupSearchBase": "ou=groups,dc=company,dc=com"\n`;
    code += `    }\n`;
    code += `  }'\n\n`;
  } else {
    code += `# 3. GRID ADMIN: Identity Federation disabled. Using StorageGRID Local Tenant Groups.\n\n`;
  }

  // 3. KMS
  if (kmsProvider !== "none") {
    code += `# 4. GRID ADMIN: Configure External Key Management Server (KMS) - Provider: ${kmsProvider.toUpperCase()}\n`;
    code += `curl -X POST "https://grid-manager.company.com/api/${apiVer}/grid/key-management-servers" \\\n`;
    code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
    code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
    code += `  -d '{\n`;
    code += `    "name": "KMS_${kmsProvider.toUpperCase()}",\n`;
    code += `    "provider": "${kmsProvider}",\n`;
    code += `    "serverPort": 5696,\n`;
    code += `    "clientCertificate": "---BEGIN CERTIFICATE---\\n...\\n---END CERTIFICATE---",\n`;
    code += `    "clientPrivateKey": "---BEGIN PRIVATE KEY---\\n...\\n---END PRIVATE KEY---"\n`;
    code += `  }'\n\n`;
  }

  // 4. Create S3 Tenant Accounts
  code += `# 5. GRID ADMIN: Create S3 Tenant Accounts\n`;
  state.sgTenants.forEach(tenant => {
    const quotaBytes = tenant.quota ? tenant.quota * 1024 * 1024 * 1024 : 0;
    code += `# Create Tenant: ${tenant.name} (Quota: ${tenant.quota || "Unlimited"} GB)\n`;
    code += `curl -X POST "https://grid-manager.company.com/api/${apiVer}/grid/accounts" \\\n`;
    code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
    code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
    code += `  -d '{\n`;
    code += `    "name": "${tenant.name}",\n`;
    code += `    "protocol": "${tenant.protocol || "s3"}",\n`;
    code += `    "policy": {\n`;
    code += `      "allowPlatformServices": true,\n`;
    if (quotaBytes > 0) {
      code += `      "quotaObjectBytes": ${quotaBytes}\n`;
    } else {
      code += `      "quotaObjectBytes": null\n`;
    }
    code += `    }\n`;
    code += `  }'\n\n`;
  });

  // 5. Generate API keys & S3 Buckets creation
  code += `# 6. TENANT ADMIN: Generate S3 Access Key pair and Create S3 Buckets\n`;
  code += `export S3_ENDPOINT="https://${haVip}:${lbPort}"\n\n`;

  state.sgTenants.forEach(tenant => {
    if (tenant.protocol === "swift") {
      code += `# Skip bucket configuration for Tenant ${tenant.name} (uses OpenStack Swift protocol)\n\n`;
      return;
    }
    code += `# S3 access configuration for Tenant: ${tenant.name}\n`;
    code += `# Authenticate to Tenant Management API to get Bearer token\n`;
    code += `curl -X POST "https://tenant-portal.company.com/api/${apiVer}/authorize" \\\n`;
    code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
    code += `  -d '{\n`;
    code += `    "accountId": "$TENANT_${tenant.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_ACCOUNT_ID",\n`;
    code += `    "username": "root",\n`;
    code += `    "password": "SecureTenantRootPassword123"\n`;
    code += `  }' > auth_${tenant.name}.json\n`;
    code += `export TENANT_TOKEN=$(cat auth_${tenant.name}.json | jq -r '.token // .data')\n\n`;

    code += `# Generate S3 access keys\n`;
    code += `curl -X POST "https://tenant-portal.company.com/api/${apiVer}/org/users/root/s3-access-keys" \\\n`;
    code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
    code += `  -H "Authorization: Bearer $TENANT_TOKEN" \\\n`;
    code += `  -d '{}' > keys_${tenant.name}.json\n`;
    code += `export AWS_ACCESS_KEY_ID=$(cat keys_${tenant.name}.json | jq -r '.accessKey // .data.accessKey')\n`;
    code += `export AWS_SECRET_ACCESS_KEY=$(cat keys_${tenant.name}.json | jq -r '.secretKey // .data.secretKey')\n\n`;

    // Filter buckets for this tenant
    const tenantBuckets = state.sgBuckets.filter(b => b.tenantName === tenant.name);
    tenantBuckets.forEach(bucket => {
      let lockOpt = bucket.objectLock ? " --object-lock-enabled-for-bucket" : "";
      const region = bucket.region || "us-east-1";
      const locOpt = region === "us-east-1" ? "" : ` --create-bucket-configuration LocationConstraint=${region}`;
      
      code += `  # Create S3 Bucket: ${bucket.name} (Region: ${region})\n`;
      code += `  aws s3api create-bucket --bucket ${bucket.name} --region ${region}${locOpt}${lockOpt} --endpoint-url $S3_ENDPOINT\n`;

      if (bucket.versioning) {
        code += `  # Enable S3 Bucket Object Versioning\n`;
        code += `  aws s3api put-bucket-versioning --bucket ${bucket.name} --versioning-configuration Status=Enabled --endpoint-url $S3_ENDPOINT\n`;
      }

      if (bucket.objectLock) {
        code += `  # Configure Object Lock (WORM compliance) retention settings\n`;
        code += `  aws s3api put-object-lock-configuration --bucket ${bucket.name} --object-lock-configuration '{\n`;
        code += `    "ObjectLockEnabled": "Enabled",\n`;
        code += `    "Rule": {\n`;
        code += `      "DefaultRetention": {\n`;
        code += `        "Mode": "COMPLIANCE",\n`;
        code += `        "Days": ${bucket.retentionDays || 30}\n`;
        code += `      }\n`;
        code += `    }\n`;
        code += `  }' --endpoint-url $S3_ENDPOINT\n`;
      }

      // Event notifications
      if (bucket.eventNotifications) {
        if (versionNum >= 120) {
          code += `  # S3 Event Notifications (StorageGRID 12.0 Webhook integration)\n`;
          code += `  aws s3api put-bucket-notification-configuration --bucket ${bucket.name} --notification-configuration '{\n`;
          code += `    "QueueConfigurations": [\n`;
          code += `      {\n`;
          code += `        "Id": "Webhook-Notify-${bucket.name}",\n`;
          code += `        "QueueArn": "urn:sg:webhook:::http-webhook-receiver-${bucket.name}",\n`;
          code += `        "Events": ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]\n`;
          code += `      }\n`;
          code += `    ]\n`;
          code += `  }' --endpoint-url $S3_ENDPOINT\n`;
        } else {
          code += `  # S3 Event Notifications (SNS integration)\n`;
          code += `  aws s3api put-bucket-notification-configuration --bucket ${bucket.name} --notification-configuration '{\n`;
          code += `    "TopicConfigurations": [\n`;
          code += `      {\n`;
          code += `        "Id": "SNS-Notify-${bucket.name}",\n`;
          code += `        "TopicArn": "arn:aws:sns:us-east-1:000000000000:grid-events-${bucket.name}",\n`;
          code += `        "Events": ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]\n`;
          code += `      }\n`;
          code += `    ]\n`;
          code += `  }' --endpoint-url $S3_ENDPOINT\n`;
        }
      }

      // Bucket Branches (StorageGRID 12.0+)
      if (versionNum >= 120 && bucket.bucketBranches) {
        code += `  # StorageGRID 12.0 Bucket Branches (Space-efficient dataset point-in-time copy)\n`;
        code += `  curl -X POST "$S3_ENDPOINT/${bucket.name}/?branch" \\\n`;
        code += `    -H "Authorization: AWS $AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \\\n`;
        code += `    -d '{\n`;
        code += `      "BranchName": "ai-dev-branch-${bucket.name}",\n`;
        code += `      "SourceTime": "${new Date().toISOString()}",\n`;
        code += `      "Mode": "ReadWrite"\n`;
        code += `    }'\n`;
      }

      // CloudMirror replication
      if (bucket.cloudMirror) {
        code += `  # CloudMirror replication to external public cloud\n`;
        code += `  aws s3api put-bucket-replication --bucket ${bucket.name} --replication-configuration '{\n`;
        code += `    "Role": "arn:aws:iam::000000000000:role/ReplicationRole",\n`;
        code += `    "Rules": [\n`;
        code += `      {\n`;
        code += `        "Id": "Mirror-${bucket.name}",\n`;
        code += `        "Status": "Enabled",\n`;
        code += `        "Destination": {\n`;
        code += `          "Bucket": "arn:aws:s3:::company-cloud-backup-${bucket.name}"\n`;
        code += `        }\n`;
        code += `      }\n`;
        code += `    ]\n`;
        code += `  }' --endpoint-url $S3_ENDPOINT\n`;
      }

      // Search Integration
      if (bucket.searchIntegration) {
        code += `  # Elasticsearch metadata Search Integration\n`;
        code += `  curl -X PUT "$S3_ENDPOINT/${bucket.name}/?metadataNotification" \\\n`;
        code += `    -H "Authorization: AWS $AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \\\n`;
        code += `    -d '<MetadataNotificationConfiguration xmlns="http://sg.netapp.com/doc/2010-08-01/">\n`;
        code += `          <Rule>\n`;
        code += `            <ID>MetadataSearch-${bucket.name}</ID>\n`;
        code += `            <Status>Enabled</Status>\n`;
        code += `            <Prefix></Prefix>\n`;
        code += `            <Destination>\n`;
        code += `              <Urn>urn:sg:es:::es-metadata-cluster-${bucket.name}</Urn>\n`;
        code += `            </Destination>\n`;
        code += `          </Rule>\n`;
        code += `        </MetadataNotificationConfiguration>'\n`;
      }
      code += `\n`;
    });
  });

  // 11. ILM policy rules
  code += `# 7. GRID ADMIN: Information Lifecycle Management (ILM) Replication Policy\n`;
  code += `# Policy profiles selected: ${ilmPolicy.toUpperCase()}\n`;
  code += `# Retrieve existing rules to link them by ID/UUID in the policy\n`;
  code += `export RULE_UUID_1=$(curl -s -X GET "https://grid-manager.company.com/api/${apiVer}/grid/ilm-rules" \\\n`;
  code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" | jq -r '.data[] | select(.name == "${ilmPolicy === '2_copies' ? '2-copies-replicate' : (ilmPolicy === '3_copies' ? '3-copies-replicate' : 'erasure-coding-protection')}") | .id')\n`;
  code += `export RULE_UUID_DEFAULT=$(curl -s -X GET "https://grid-manager.company.com/api/${apiVer}/grid/ilm-rules" \\\n`;
  code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" | jq -r '.data[] | select(.name == "default-rule") | .id')\n\n`;

  code += `curl -X POST "https://grid-manager.company.com/api/${apiVer}/grid/ilm-policies" \\\n`;
  code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
  code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
  code += `  -d '{\n`;
  code += `    "name": "ILM_Policy_${ilmPolicy.toUpperCase()}",\n`;
  code += `    "rules": ["'$RULE_UUID_1'", "'$RULE_UUID_DEFAULT'"],\n`;
  code += `    "defaultRule": "'$RULE_UUID_DEFAULT'"\n`;
  code += `  }'\n\n`;

  // TLS Compliance security setting
  code += `# 8. GRID ADMIN: Enforce security & TLS settings Profile: ${tlsComp.toUpperCase()}\n`;
  code += `curl -X PUT "https://grid-manager.company.com/api/${apiVer}/grid/security-settings" \\\n`;
  code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
  code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
  code += `  -d '{\n`;
  code += `    "tlsPolicy": "${tlsComp}"\n`;
  code += `  }'\n`;

  // StorageGRID 12.0+ Specific Features (Assume Role & Caching Layer)
  if (versionNum >= 120) {
    if (state.sgIntegrations.assumeRole) {
      code += `\n# 9. GRID ADMIN (StorageGRID 12.0+): Configure short-term IAM Assume Role (STS)\n`;
      code += `curl -X POST "https://grid-manager.company.com/api/${apiVer}/grid/iam-roles" \\\n`;
      code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
      code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
      code += `  -d '{\n`;
      code += `    "roleName": "S3-Developer-Role",\n`;
      code += `    "trustPolicy": {\n`;
      code += `      "Statement": [{\n`;
      code += `        "Effect": "Allow",\n`;
      code += `        "Principal": { "AWS": "arn:aws:iam::000000000000:root" },\n`;
      code += `        "Action": "sts:AssumeRole"\n`;
      code += `      }]\n`;
      code += `    }\n`;
      code += `  }'\n`;
    }
    if (state.sgIntegrations.s3Caching) {
      code += `\n# 10. GRID ADMIN (StorageGRID 12.0+): Enable high-performance S3 Caching Layer for AI/ML\n`;
      code += `curl -X PUT "https://grid-manager.company.com/api/${apiVer}/grid/s3-caching" \\\n`;
      code += `  -H "accept: application/json" -H "Content-Type: application/json" \\\n`;
      code += `  -H "Authorization: Bearer $GRID_ADMIN_TOKEN" \\\n`;
      code += `  -d '{\n`;
      code += `    "isEnabled": true,\n`;
      code += `    "cacheMode": "ReadThroughWriteThrough",\n`;
      code += `    "maxCacheSizeBytes": 5497558138880\n`;
      code += `  }'\n`;
    }
  }

  return code;
}

function generateAnsiblePlaybook() {
  const proto = state.protocol;
  const node1 = state.customNodeNames[0] || "cluster1-01";
  const node2 = state.customNodeNames[1] || "cluster1-02";
  let code = `---
- name: Automate NetApp Storage Provisioning
  hosts: localhost
  gather_facts: false
  collections:
    - netapp.ontap

  vars:
    login:
      hostname: "${state.network.mgmtIp}"
      username: "admin"
      password: "NetAppPassword123"
      https: true
      validate_certs: false

  tasks:\n`;

  if (state.platform === "storagegrid") {
    const haVip = state.sgIntegrations.haVip || "192.168.10.50";
    const vipParts = haVip.split(".");
    const gatewayCidr = vipParts.length === 4 ? `${vipParts[0]}.${vipParts[1]}.${vipParts[2]}.0/24` : "192.168.10.0/24";

    let play = `---
- name: Provision StorageGRID Platform and Tenant Buckets
  hosts: localhost
  gather_facts: false
  collections:
    - netapp.storagegrid

  vars:
    grid_login:
      api_url: "https://grid-manager.company.com"
      api_username: "admin"
      api_password: "SecureGridPassword123"
      validate_certs: false

  tasks:
    - name: Create High Availability (HA) Group
      netapp.storagegrid.na_sg_grid_ha_group:
        state: present
        name: "${state.sgIntegrations.haGroupName || 'ha-gateway-group'}"
        description: "HA Group for S3 load balancing"
        gateway_cidr: "${gatewayCidr}"
        virtual_ips:
          - "${haVip}"
        interfaces:
`;
    const members = state.sgIntegrations.haMembers || "sg-gateway-01, sg-gateway-02";
    members.split(",").forEach(member => {
      play += `          - node: "${member.trim()}"
            interface: "eth0"\n`;
    });
    play += `        <<: "{{ grid_login }}"

    - name: Create S3 Load Balancer Endpoint
      netapp.storagegrid.na_sg_grid_gateway:
        state: present
        display_name: "${state.sgIntegrations.lbEndpointName || 's3-load-balancer'}"
        port: ${state.sgIntegrations.lbPort || 10443}
        binding_mode: "ha-groups"
        ha_groups:
          - "${state.sgIntegrations.haGroupName || 'ha-gateway-group'}"
        default_service_type: "s3"
        enable_ipv4: true
        <<: "{{ grid_login }}"
`;

    // Tenants creation
    state.sgTenants.forEach(tenant => {
      play += `
    - name: Create Tenant Account ${tenant.name}
      netapp.storagegrid.na_sg_grid_account:
        state: present
        name: "${tenant.name}"
        protocol: "${tenant.protocol || 's3'}"
        allow_platform_services: true
        quota_size: ${tenant.quota || 0}
        quota_size_unit: "gb"
        <<: "{{ grid_login }}"
`;
    });

    // Buckets creation
    state.sgBuckets.forEach(bucket => {
      play += `
    - name: Create S3 Bucket ${bucket.name}
      netapp.storagegrid.na_sg_org_container:
        state: present
        tenant_name: "${bucket.tenantName}"
        name: "${bucket.name}"
        region: "${bucket.region || 'us-east-1'}"
        bucket_versioning_enabled: ${bucket.versioning ? 'true' : 'false'}
        s3_object_lock_enabled: ${bucket.objectLock ? 'true' : 'false'}
        <<: "{{ grid_login }}"
`;
    });

    const versionNum = versionToNum(state.version);
    if (versionNum >= 120) {
      if (state.sgIntegrations.assumeRole) {
        play += `
    - name: Configure IAM Role for STS AssumeRole
      netapp.storagegrid.na_sg_grid_iam_role:
        state: present
        name: "S3-Developer-Role"
        trust_policy_document: "{\\"Statement\\":[{\\"Effect\\":\\"Allow\\",\\"Principal\\":{\\"AWS\\":\\"arn:aws:iam::000000000000:root\\"},\\"Action\\":\\"sts:AssumeRole\\"}]}"
        <<: "{{ grid_login }}"
`;
      }
      if (state.sgIntegrations.s3Caching) {
        play += `
    - name: Configure S3 Caching Layer
      netapp.storagegrid.na_sg_grid_s3_caching:
        state: present
        enabled: true
        cache_mode: "ReadThroughWriteThrough"
        max_cache_size_gb: 5120
        <<: "{{ grid_login }}"
`;
      }
    }

    return play;
  }

  // Greenfield Aggregates Setup [NEW]
  if (state.platform === "ontap" && state.mode === "greenfield") {
    const aggrPrefix = state.sizing.aggrNamePrefix || "aggr_data";
    const halfDiskCount = Math.floor(state.sizing.diskCount / 2);
    
    code += `    - name: Create Aggregate ${aggrPrefix}_1 on Node 1
      netapp.ontap.na_ontap_aggregate:
        state: present
        name: "${aggrPrefix}_1"
        nodes: "${node1}"
        disk_count: ${halfDiskCount}
        raid_size: ${state.sizing.raidGroupSize}
        raid_type: "${state.sizing.raidType === "raid_dp" ? "raid_dp" : "raid_tec"}"
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;

    code += `    - name: Create Aggregate ${aggrPrefix}_2 on Node 2
      netapp.ontap.na_ontap_aggregate:
        state: present
        name: "${aggrPrefix}_2"
        nodes: "${node2}"
        disk_count: ${halfDiskCount}
        raid_size: ${state.sizing.raidGroupSize}
        raid_type: "${state.sizing.raidType === "raid_dp" ? "raid_dp" : "raid_tec"}"
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
  }

  // Loop over SVMs for ONTAP
  state.svms.forEach(svm => {
    if (state.mode === "greenfield") {
      code += `    - name: Create SVM ${svm.name}
      na_ontap_svm:
        state: present
        name: "${svm.name}"
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
    }
  });

  // FabricPool Target creation inside ONTAP playbook if enabled
  if (state.ontapFabricPool.enabled) {
    const provider = state.ontapFabricPool.providerType || "SG";
    code += `    - name: Create FabricPool ${provider} Object Store Target
      netapp.ontap.na_ontap_object_store:
        state: present
        object_store_name: "sg_fabricpool_target"
        provider_type: "${provider}"
        server: "${state.ontapFabricPool.endpoint}"
        port: ${state.ontapFabricPool.port}
        container: "${state.ontapFabricPool.bucket}"
        access_key: "${state.ontapFabricPool.accessKey}"
        secret_key: "${state.ontapFabricPool.secretKey}"
        ssl_enabled: ${state.ontapFabricPool.sslEnabled ? 'true' : 'false'}
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;

    // Gather unique aggregates from volumes with tiering policy !== "none"
    const tieredAggrs = [];
    state.volumes.forEach(vol => {
      if (vol.fabricpool && vol.fabricpool !== "none") {
        if (!tieredAggrs.includes(vol.aggregate)) {
          tieredAggrs.push(vol.aggregate);
        }
      }
    });

    tieredAggrs.forEach(aggr => {
      code += `    - name: Attach FabricPool Target to Aggregate ${aggr}
      netapp.ontap.na_ontap_aggregate:
        state: present
        name: "${aggr}"
        object_store_name: "sg_fabricpool_target"
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
    });
  }

  // Create QoS Policy Groups [NEW]
  if (state.platform === "ontap" && state.qos.policyType !== "none") {
    state.svms.forEach(svm => {
      const policyName = `qos_${svm.name}_policy`;
      if (state.qos.policyType === "shared" || state.qos.policyType === "non_shared") {
        const isShared = state.qos.policyType === "shared" ? "true" : "false";
        code += `    - name: Create QoS Policy Group ${policyName}
      netapp.ontap.na_ontap_qos_policy_group:
        state: present
        name: "${policyName}"
        vserver: "${svm.name}"
        max_throughput_iops: ${state.qos.peakIops}
        max_throughput_mbps: ${state.qos.peakThroughput}
        min_throughput_iops: ${state.qos.expectedIops}
        is_shared: ${isShared}
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
      } else if (state.qos.policyType === "adaptive") {
        code += `    - name: Create Adaptive QoS Policy Group ${policyName}
      netapp.ontap.na_ontap_qos_adaptive_policy_group:
        state: present
        name: "${policyName}"
        vserver: "${svm.name}"
        expected_iops: ${state.qos.allocatedIops}
        peak_iops: ${state.qos.peakIopsPerTb}
        absolute_min_iops: ${state.qos.absoluteMinIops}
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
      }
    });
  }

  // Loop over Volumes for ONTAP
  state.volumes.forEach((vol, idx) => {
    let fpPolicyStr = "";
    if (vol.fabricpool && vol.fabricpool !== "none" && vol.fabricpool !== "false" && vol.fabricpool !== false) {
      const policyVal = vol.fabricpool === true ? "auto" : vol.fabricpool;
      fpPolicyStr = `\n        tiering_policy: "${policyVal}"`;
      if ((policyVal === "auto" || policyVal === "snapshot-only") && vol.coolingDays && vol.coolingDays !== 31) {
        fpPolicyStr += `\n        tiering_minimum_cooling_days: ${vol.coolingDays}`;
      }
    }

    const aggrName = state.mode === "greenfield" ? ((state.sizing.aggrNamePrefix || "aggr_data") + "_" + (idx % 2 === 0 ? "1" : "2")) : vol.aggregate;
    let qosPolicyStr = "";
    if (state.qos.policyType !== "none") {
      const policyName = `qos_${vol.svmName}_policy`;
      if (state.qos.policyType === "adaptive") {
        qosPolicyStr = `\n        adaptive_policy_group: "${policyName}"`;
      } else {
        qosPolicyStr = `\n        qos_policy_group: "${policyName}"`;
      }
    }

    code += `    - name: Create Volume ${vol.name}
      na_ontap_volume:
        state: present
        vserver: "${vol.svmName}"
        name: "${vol.name}"
        aggregate: "${aggrName}"
        size: ${vol.size}
        size_unit: "${vol.sizeUnit.toLowerCase()}"
        space_guarantee: none
        encrypt: ${vol.encryption ? 'true' : 'false'}
        compression: true
        inline_deduplication: true${fpPolicyStr}${qosPolicyStr}
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
  });

  // Loop over LUNs / Namespaces for ONTAP SAN volumes
  state.volumes.forEach(vol => {
    const isVolSan = vol.type === "san" || (vol.luns && vol.luns.length > 0);
    if (isVolSan && vol.luns) {
      const activeProtos = state.protocols || [state.protocol || "nfs"];
      const isNvme = activeProtos.some(p => p.startsWith("nvme"));
      vol.luns.forEach(lun => {
        const path = `/vol/${vol.name}/${lun.name}`;
        if (lun.name.startsWith("ns_") || isNvme) {
          // NVMe Namespace Ansible Task
          code += `    - name: Create NVMe Namespace ${lun.name} in Volume ${vol.name}
      netapp.ontap.na_ontap_nvme_namespace:
        state: present
        vserver: "${vol.svmName}"
        path: "${path}"
        size: ${lun.size}
        size_unit: "${lun.sizeUnit.toLowerCase()}"
        ostype: "${lun.osType}"
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
        } else {
          // Standard LUN Ansible Task
          code += `    - name: Create LUN ${lun.name} in Volume ${vol.name}
      netapp.ontap.na_ontap_lun:
        state: present
        vserver: "${vol.svmName}"
        name: "${lun.name}"
        flexvol_name: "${vol.name}"
        size: ${lun.size}
        size_unit: "${lun.sizeUnit.toLowerCase()}"
        ostype: "${lun.osType}"
        space_reserve: false
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;

          // Check if we can map it to an igroup if SAN protocol is configured
          if (activeProtos.includes("iscsi")) {
            code += `    - name: Map LUN ${lun.name} to iSCSI igroup
      netapp.ontap.na_ontap_lun_map:
        state: present
        vserver: "${vol.svmName}"
        path: "${path}"
        igroup_name: "ig_${vol.svmName}"
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
          }
          if (activeProtos.includes("fc") || activeProtos.includes("fcoe")) {
            const fcConf = state.protocolData.fc || { igroupName: "ig_fc" };
            code += `    - name: Map LUN ${lun.name} to FC igroup
      netapp.ontap.na_ontap_lun_map:
        state: present
        vserver: "${vol.svmName}"
        path: "${path}"
        igroup_name: "${fcConf.igroupName || 'igroup_fc'}_${vol.svmName}"
        hostname: "{{ login.hostname }}"
        username: "{{ login.username }}"
        password: "{{ login.password }}"\n\n`;
          }
        }
      });
    }
  });

  return code;
}

function generateTridentConfig() {
  if (!state.trident.enabled) {
    return `# Kubernetes NetApp Trident Integration: Disabled`;
  }

  const firstSvm = state.svms[0].name;
  const firstAggr = state.volumes[0].aggregate;
  const fsType = state.trident.fsType;
  const backend = state.trident.backendName;
  const policy = state.trident.reclaimPolicy;

  let tridentBackendType = "ontap-nas";
  if (state.protocol === "iscsi" || state.protocol === "fc" || state.protocol === "fcoe") {
    tridentBackendType = "ontap-san";
  }

  let code = `apiVersion: trident.netapp.io/v1
kind: TridentBackendConfig
metadata:
  name: ${backend}
  namespace: trident
spec:
  version: 1
  storageDriverName: ${tridentBackendType}
  managementLIF: ${state.network.mgmtIp}
  svm: ${firstSvm}
  username: admin
  password: NetAppPassword123
  aggregate: ${firstAggr}
  defaults:
    spaceReserve: none
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: netapp-sc-${tridentBackendType}
provisioner: csi.trident.netapp.io
reclaimPolicy: ${policy}
allowVolumeExpansion: true
parameters:
  backendType: ${tridentBackendType}
  fsType: ${fsType}
`;
  return code;
}

function generateSwitchConfig() {
  const brand = state.network.switchBrand;
  const speed = state.network.portSpeed;
  const mtu = state.network.mtu;
  const vlan = state.network.vlanId;
  const proto = state.protocol;
  const switchVersionVal = versionToNum(state.network.switchVersion);
  const nodeCount = parseInt(state.sizing.nodeCount) || 2;
  const mcc = state.metrocluster;

  let code = ``;

  if (state.platform === "ontap") {
    code += `# =========================================================================\n`;
    code += `# NETAPP CLUSTER & FABRIC SWITCH CONFIGURATION SPECIFICATIONS\n`;
    code += `# Switch Fabric Brand: ${brand.toUpperCase()} | Speed: ${speed} Gb/s | MTU: ${mtu}\n`;
    code += `# Cluster Node Count: ${nodeCount} Nodes\n`;
    if (mcc && mcc.enabled) {
      code += `# MetroCluster Configuration: Enabled (${mcc.type.toUpperCase()} - ${mcc.scale} Nodes)\n`;
    }
    code += `# =========================================================================\n\n`;

    // 1. CLUSTER INTERCONNECT SWITCHES
    code += `# =========================================================================\n`;
    code += `# SECTION 1: CLUSTER INTERCONNECT SWITCH CONFIGURATION\n`;
    code += `# =========================================================================\n`;
    if (brand === "cisco") {
      code += `# Target Switch: Cisco Nexus 3132Q-V or Cisco Nexus 9336C-FX2 (Cluster Switch)\n`;
      code += `# RCF File Pattern: NX3132_v1.80_Cluster_${nodeCount}Node.rcf\n\n`;
      code += `# 1A. Download Reference Configuration File (RCF) via SFTP:\n`;
      code += `copy sftp://admin@${state.network.mgmtIp || "192.168.1.50"}/rcf/NX3132_v1.80_Cluster_${nodeCount}Node.rcf bootflash:NX3132.rcf\n\n`;
      code += `# 1B. Apply RCF File and Save to Startup Config:\n`;
      code += `copy bootflash:NX3132.rcf running-config\n`;
      code += `copy running-config startup-config\n\n`;
      code += `# 1C. Port Allocation & Settings Matrix:\n`;
      code += `# Port Range       | Connected To                    | Mode        | Speed   | MTU   | VLAN\n`;
      code += `# -----------------|---------------------------------|-------------|---------|-------|------\n`;
      for (let i = 1; i <= nodeCount; i++) {
        const nodeName = state.customNodeNames[i - 1] || `cluster1-0${i}`;
        code += `# Ethernet 1/${i}      | Node ${nodeName} (port e0a)      | Trunk/Clust | 100 Gb  | 9000  | 3700\n`;
        code += `# Ethernet 1/${i + 16}     | Node ${nodeName} (port e0b)      | Trunk/Clust | 100 Gb  | 9000  | 3700\n`;
      }
      code += `# Ethernet 1/31-32 | Inter-Switch Link (ISL Peer)    | LACP Trunk  | 100 Gb  | 9000  | 3700\n\n`;
    } else if (brand === "brocade") {
      code += `# Target Switch: Broadcom BES-53248 Cluster Interconnect Switch\n`;
      code += `# RCF File Pattern: BES-53248_v1.30_Cluster.scr\n\n`;
      code += `# 1A. Download RCF Script from TFTP server:\n`;
      code += `copy tftp://${state.network.mgmtIp || "192.168.1.50"}/BES-53248_v1.30_Cluster.scr nvram:script\n\n`;
      code += `# 1B. Apply RCF Script and Write Memory:\n`;
      code += `script apply BES-53248_v1.30_Cluster.scr\n`;
      code += `write memory\n\n`;
      code += `# 1C. Port Allocation & Settings Matrix:\n`;
      code += `# Port Range       | Connected To                    | Mode        | Speed   | MTU   | VLAN\n`;
      code += `# -----------------|---------------------------------|-------------|---------|-------|------\n`;
      for (let i = 1; i <= nodeCount; i++) {
        const nodeName = state.customNodeNames[i - 1] || `cluster1-0${i}`;
        code += `# Port 1/${i}          | Node ${nodeName} (port e0a)      | Trunk/Clust | 25 Gb   | 9000  | 3700\n`;
        code += `# Port 1/${i + 24}     | Node ${nodeName} (port e0b)      | Trunk/Clust | 25 Gb   | 9000  | 3700\n`;
      }
      code += `# Port 1/49-52     | Inter-Switch Link (ISL Peer)    | LACP Trunk  | 100 Gb  | 9000  | 3700\n\n`;
    } else {
      code += `# Switch Brand set to Generic. Configure cluster switches manually:\n`;
      code += `# - Create Cluster VLAN 3700\n`;
      code += `# - Enable MTU 9000 (Jumbo Frames) on all ports\n`;
      code += `# - Map Node Cluster ports (e0a, e0b) to switch access ports in VLAN 3700\n\n`;
    }

    // 2. METROCLUSTER SWITCHES
    if (mcc && mcc.enabled) {
      code += `# =========================================================================\n`;
      code += `# SECTION 2: METROCLUSTER SWITCH CONFIGURATION\n`;
      code += `# =========================================================================\n`;
      if (mcc.type === "ip") {
        code += `# MetroCluster Type: METROCLUSTER IP (Synchronous Ethernet Replication)\n`;
        if (brand === "cisco") {
          code += `# Target Switch Hardware: Cisco Nexus 9336C-FX2 (MetroCluster Switch)\n`;
          code += `# RCF File Pattern: N9K_9336C_MetroCluster_IP_v1.8.rcf\n\n`;
          code += `# 2A. Download MetroCluster RCF File via SFTP:\n`;
          code += `copy sftp://admin@${state.network.mgmtIp || "192.168.1.50"}/rcf/N9K_9336C_MetroCluster_IP_v1.8.rcf bootflash:MC_IP.rcf\n\n`;
          code += `# 2B. Apply RCF Configuration Script:\n`;
          code += `copy bootflash:MC_IP.rcf running-config\n`;
          code += `copy running-config startup-config\n\n`;
          code += `# 2C. Switch Port Configuration & Mode Matrix:\n`;
          code += `# Port Range       | Connected To                    | Mode        | Speed   | MTU   | VLANs / Description\n`;
          code += `# -----------------|---------------------------------|-------------|---------|-------|--------------------\n`;
          code += `# Ethernet 1/1-2   | Node 1 (port e5a, e5b)          | Access/TR   | 25 Gb   | 9000  | VLAN 10 (Fabric A) / VLAN 20 (Fabric B)\n`;
          code += `# Ethernet 1/3-4   | Node 2 (port e5a, e5b)          | Access/TR   | 25 Gb   | 9000  | VLAN 10 (Fabric A) / VLAN 20 (Fabric B)\n`;
          code += `# Ethernet 1/17-20 | Local NS224 NVMe Storage Shelf  | Access      | 100 Gb  | 9000  | VLAN 100 (Internal Storage Loop)\n`;
          code += `# Ethernet 1/35-36 | Inter-Site ISLs (to Remote Sw)  | LACP Trunk  | 100 Gb  | 9000  | VLANs 10, 20 (MetroCluster Peering)\n\n`;
        } else if (brand === "brocade") {
          code += `# Target Switch Hardware: Broadcom BES-53248 (MetroCluster IP Switch)\n`;
          code += `# RCF File Pattern: BES-53248_v1.40_MetroCluster_IP.scr\n\n`;
          code += `# 2A. Download RCF Script from TFTP server:\n`;
          code += `copy tftp://${state.network.mgmtIp || "192.168.1.50"}/BES-53248_v1.40_MetroCluster_IP.scr nvram:script\n\n`;
          code += `# 2B. Apply RCF Script and Write Memory:\n`;
          code += `script apply BES-53248_v1.40_MetroCluster_IP.scr\n`;
          code += `write memory\n\n`;
          code += `# 2C. Switch Port Configuration & Mode Matrix:\n`;
          code += `# Port Range       | Connected To                    | Mode        | Speed   | MTU   | VLANs / Description\n`;
          code += `# -----------------|---------------------------------|-------------|---------|-------|--------------------\n`;
          code += `# Port 1/1-2       | Node 1 (port e5a, e5b)          | Access/TR   | 25 Gb   | 9000  | VLAN 10 (Fabric A) / VLAN 20 (Fabric B)\n`;
          code += `# Port 1/3-4       | Node 2 (port e5a, e5b)          | Access/TR   | 25 Gb   | 9000  | VLAN 10 (Fabric A) / VLAN 20 (Fabric B)\n`;
          code += `# Port 1/17-20     | Local Storage Shelf             | Access      | 10 Gb   | 9000  | VLAN 100 (Internal Storage Loop)\n`;
          code += `# Port 1/49-52     | Inter-Site ISLs (to Remote Sw)  | LACP Trunk  | 100 Gb  | 9000  | VLANs 10, 20 (MetroCluster Peering)\n\n`;
        } else {
          code += `# Generic Switch configuration for MetroCluster IP:\n`;
          code += `# - Configure MTU 9000 (Jumbo Frames) on all ports.\n`;
          code += `# - Configure Fabric A VLAN 10 and Fabric B VLAN 20.\n`;
          code += `# - Map Node ports (e5a/e5b) to access ports on VLAN 10/20 respectively.\n`;
          code += `# - Enable LACP Trunking on Inter-Site Links (ISLs) to allow VLAN 10 and 20 traffic.\n\n`;
        }
      } else if (mcc.type === "fc") {
        code += `# MetroCluster Type: METROCLUSTER FC (Fibre Channel SAN Replication)\n`;
        code += `# Target Switch Hardware: Brocade G620 or Brocade G630 (Fibre Channel Switch)\n`;
        code += `# RCF File Pattern: Brocade_G620_v1.60_MetroCluster_FC.sdd\n\n`;
        code += `# 2A. Download RCF Configuration Template:\n`;
        code += `configDownload -sftp ${state.network.mgmtIp || "192.168.1.50"},admin,/rcf/Brocade_G620_v1.60.sdd\n\n`;
        code += `# 2B. Enable Zoning and Activate configuration:\n`;
        code += `cfgsave\n`;
        code += `cfgenable "cfg_NetApp_MC_FC"\n\n`;
        code += `# 2C. Switch Port Mode and Settings Matrix:\n`;
        code += `# FC Port Range    | Connected To                    | Port Mode   | Speed   | Description\n`;
        code += `# -----------------|---------------------------------|-------------|---------|-------------\n`;
        code += `# Port 0-3         | Node FC-VI / FC HBAs            | F_Port      | 32 G    | Node Interconnect Fabric\n`;
        code += `# Port 4-7         | ATTO FibreBridge (FC-to-SAS)    | F_Port      | 16 G    | Disk Shelf Loop Interconnect\n`;
        code += `# Port 16-17       | Inter-Site ISLs (to Site B)     | E_Port (ISL)| 32 G    | Remote Site Peer Trunk\n\n`;
      }
    }
  }

  // 3. CLIENT DATA FABRIC / SAN SWITCHES (Existing Zoning/Trunking configurations)
  code += `# =========================================================================\n`;
  code += `# SECTION 3: CLIENT DATA FABRIC / HOST SAN SWITCH CONFIGURATION\n`;
  code += `# =========================================================================\n`;
  
  if (brand === "cisco") {
    if (proto === "fc" || proto === "fcoe" || proto === "nvme_fc") {
      const fcConf = state.protocolData.fc;
      const targets = fcConf.targetWwpn.split(",").map(t => t.trim());
      const initiators = fcConf.initiatorWwpn.split(",").map(i => i.trim());
      
      code += `configure terminal\n`;
      code += `vsan database\n`;
      code += `  vsan ${vlan} name SAN-VLAN-${vlan}\n`;
      code += `exit\n\n`;

      code += `# 1. Configure Zone Membership Names\n`;
      initiators.forEach((init, idx) => {
        targets.forEach((tgt, tIdx) => {
          const zoneName = `Z_HOST_01_PORT_0${idx + 1}_TGT_0${tIdx + 1}`;
          code += `zone name ${zoneName} vsan ${vlan}\n`;
          if (switchVersionVal >= 900) {
            code += `  member pwwn ${init} host\n`;
            code += `  member pwwn ${tgt} target\n`;
          } else {
            code += `  member pwwn ${init}\n`;
            code += `  member pwwn ${tgt}\n`;
          }
          code += `exit\n`;
        });
      });

      code += `\n# 2. Activate Zone Set Config\n`;
      code += `zoneset name ZS_NETAPP_SAN vsan ${vlan}\n`;
      initiators.forEach((init, idx) => {
        targets.forEach((tgt, tIdx) => {
          const zoneName = `Z_HOST_01_PORT_0${idx + 1}_TGT_0${tIdx + 1}`;
          code += `  member ${zoneName}\n`;
        });
      });
      code += `exit\n\n`;
      code += `zoneset activate name ZS_NETAPP_SAN vsan ${vlan}\n`;
      code += `copy running-config startup-config\n`;
    } else {
      code += `configure terminal\n`;
      code += `vlan ${vlan}\n`;
      code += `  name NetApp-Ethernet-Data\n`;
      code += `exit\n\n`;
      code += `interface ethernet 1/1-4\n`;
      code += `  switchport mode trunk\n`;
      code += `  switchport trunk allowed vlan ${vlan}\n`;
      if (mtu === "9000") {
        code += `  system default mtu 9000\n`;
        code += `  mtu 9000\n`;
      }
      code += `  no shutdown\n`;
    }
  } 
  else if (brand === "brocade") {
    if (proto === "fc" || proto === "fcoe" || proto === "nvme_fc") {
      const fcConf = state.protocolData.fc;
      const targets = fcConf.targetWwpn.split(",").map(t => t.trim());
      const initiators = fcConf.initiatorWwpn.split(",").map(i => i.trim());

      code += `# Create Zoning definitions mapping Host WWPNs to NetApp Storage Ports\n`;
      
      let createdZones = [];
      if (switchVersionVal >= 900) {
        initiators.forEach((init, idx) => {
          targets.forEach((tgt, tIdx) => {
            const zoneName = `z_host01_p0${idx + 1}_tgt0${tIdx + 1}`;
            code += `zone --create ${zoneName} -members "${init}; ${tgt}"\n`;
            createdZones.push(zoneName);
          });
        });

        code += `\n# Add Zones to Configuration set\n`;
        code += `cfg --add cfg_NetApp_SAN -members "${createdZones.join("; ")}"\n`;
        
        code += `\n# Save & Enable Active Zone Configuration\n`;
        code += `cfgsave\n`;
        code += `cfgenable "cfg_NetApp_SAN"\n`;
      } else {
        initiators.forEach((init, idx) => {
          targets.forEach((tgt, tIdx) => {
            const zoneName = `z_host01_p0${idx + 1}_tgt0${tIdx + 1}`;
            code += `zoneCreate "${zoneName}", "${init}; ${tgt}"\n`;
            createdZones.push(zoneName);
          });
        });

        code += `\n# Add Zones to Configuration set\n`;
        code += `cfgCreate "cfg_NetApp_SAN", "${createdZones[0]}"\n`;
        for(let i=1; i<createdZones.length; i++) {
          code += `cfgAdd "cfg_NetApp_SAN", "${createdZones[i]}"\n`;
        }

        code += `\n# Save & Enable Active Zone Configuration\n`;
        code += `cfgSave\n`;
        code += `cfgEnable "cfg_NetApp_SAN"\n`;
      }
    } else {
      code += `vlan ${vlan}\n`;
      code += `  interface vlan ${vlan}\n`;
      code += `  no shutdown\n`;
      code += `exit\n\n`;
      code += `interface TenGigabitEthernet 1/0/1-4\n`;
      code += `  switchport access vlan ${vlan}\n`;
      if (mtu === "9000") {
        code += `  mtu 9000\n`;
      }
      code += `  no shutdown\n`;
    }
  }

  return code;
}

// 11. DEPLOYMENT GUIDE DOCUMENTATION GENERATOR [NEW]
function generateDeploymentGuide() {
  const proto = state.protocol.toUpperCase();
  const hypervisor = state.workload.hypervisor;
  const db = state.workload.db;

  let platformLabel = "ONTAP Cluster";
  if (state.platform === "ontap") {
    if (state.ontapPlatform === "aff") platformLabel = "NetApp AFF (All-Flash FAS)";
    else if (state.ontapPlatform === "asa") platformLabel = "NetApp ASA (All-Flash SAN Array)";
    else if (state.ontapPlatform === "afx") platformLabel = "NetApp FAS / AFX (Capacity Hybrid)";
  } else {
    platformLabel = "StorageGRID Object Store";
  }

  let md = `# NetApp Storage Architecture & Implementation Guide\n\n`;
  
  md += `## 1. Architectural Overview\n`;
  md += `This guide provides deployment structures for NetApp storage nodes based on the following configurations:\n`;
  md += `- **Storage Platform**: ${platformLabel} (Version ${state.version})\n`;
  if (state.platform === "ontap") {
    md += `- **Provisioning SVMs**: ${state.svms.map(s => s.name).join(", ")}\n`;
    md += `- **Access Protocol**: ${proto}\n`;
    const diskSizeGb = parseDiskSizeToGb(state.sizing.diskSize);
    const totalDisks = state.sizing.diskCount * (state.sizing.nodeCount / 2);
    const rawGb = totalDisks * diskSizeGb;
    
    const disksPerAggr = totalDisks / 2;
    const numRaidGroups = Math.ceil(disksPerAggr / state.sizing.raidGroupSize);
    const parityDisksPerAggr = numRaidGroups * (state.sizing.raidType === "raid_dp" ? 2 : 3);
    const totalParityDisks = parityDisksPerAggr * 2;
    const totalSpareDisks = state.sizing.spareDisks * (state.sizing.nodeCount / 2) * 2;
    const dataDisks = Math.max(0, totalDisks - totalParityDisks - totalSpareDisks);
    
    const usableAggregateCapacity = dataDisks * diskSizeGb;
    const waflCapacity = usableAggregateCapacity * 0.10;
    const usableSpaceBeforeSnapshot = usableAggregateCapacity - waflCapacity;
    const snapshotCapacity = usableSpaceBeforeSnapshot * 0.05;
    const finalUsableSpace = Math.max(0, usableSpaceBeforeSnapshot - snapshotCapacity);
    const ratio = getEfficiencyRatio();
    const logicalSpace = finalUsableSpace * ratio;

    md += `- **Hardware Controller**: NetApp ${state.sizing.controller} (${state.sizing.nodeCount} Nodes)\n`;
    md += `- **Drive Configuration**: ${totalDisks}x ${state.sizing.diskSize} drives (${state.sizing.shelfType} Shelves)\n`;
    md += `- **RAID Configuration**: ${state.sizing.raidType.toUpperCase()} (Group Size: ${state.sizing.raidGroupSize}, Spares: ${totalSpareDisks} disks)\n`;
    md += `- **Sizing Capacity Details**:\n`;
    md += `  - *Total Raw Capacity*: **${formatCapacity(rawGb)}**\n`;
    md += `  - *RAID Parity Overhead*: ${formatCapacity(totalParityDisks * diskSizeGb)} (${totalParityDisks} disks)\n`;
    md += `  - *Spare Disks Capacity*: ${formatCapacity(totalSpareDisks * diskSizeGb)} (${totalSpareDisks} disks)\n`;
    md += `  - *WAFL System Reserve (10%)*: ${formatCapacity(waflCapacity)}\n`;
    md += `  - *Snapshot Reserve (5%)*: ${formatCapacity(snapshotCapacity)}\n`;
    md += `  - *NetApp Usable Physical Capacity*: **${formatCapacity(finalUsableSpace)}**\n`;
    md += `  - *Workload Efficiency Factor*: **${ratio.toFixed(1)}:1** (Based on profiles)\n`;
    md += `  - *Effective Logical Capacity*: **${formatCapacity(logicalSpace)}**\n`;
  } else {
    md += `- **HA Virtual IP**: ${state.sgIntegrations.haVip || "192.168.10.50"}\n`;
    md += `- **Load Balancer Port**: ${state.sgIntegrations.lbPort || 10443} (${state.sgIntegrations.lbProtocol || "https"})\n`;
    const diskSizeGb = parseDiskSizeToGb(state.sizing.diskSize);
    const totalNodes = state.sizing.nodeCount;
    const ctrl = state.sizing.controller;
    const diskCount = state.sizing.diskCount;
    
    let isComputeOnly = ["SG100", "SG110", "SG1000", "SG1100"].includes(ctrl);
    let isVirtual = ["VMware_VM", "Software_Node"].includes(ctrl);
    
    let rawGb = 0;
    let parityGb = 0;
    let spareGb = 0;
    let metadataGb = 0;
    let usableGb = 0;
    let logicalGb = 0;
    let multiplier = 0.5;
    let ratioText = "0.5:1";
    
    const ilm = state.sgIntegrations.ilmPolicy;
    if (ilm === "2_copies") {
      multiplier = 0.5;
      ratioText = "0.5:1 (2-Copy Replication)";
    } else if (ilm === "3_copies") {
      multiplier = 0.3333;
      ratioText = "0.33:1 (3-Copy Replication)";
    } else if (ilm === "ec_2_1") {
      multiplier = 2 / 3;
      ratioText = "0.67:1 (Erasure Coding 2+1)";
    } else if (ilm === "ec_4_2") {
      multiplier = 4 / 6;
      ratioText = "0.67:1 (Erasure Coding 4+2)";
    } else if (ilm === "ec_6_3") {
      multiplier = 6 / 9;
      ratioText = "0.67:1 (Erasure Coding 6+3)";
    }
    
    if (!isComputeOnly) {
      const totalDisks = diskCount * totalNodes;
      rawGb = totalDisks * diskSizeGb;
      if (isVirtual) {
        parityGb = 0;
        spareGb = 0;
      } else {
        parityGb = 2 * totalNodes * diskSizeGb;
        spareGb = 2 * totalNodes * diskSizeGb;
      }
      const storageAvailableGb = Math.max(0, rawGb - parityGb - spareGb);
      metadataGb = storageAvailableGb * 0.15;
      usableGb = Math.max(0, storageAvailableGb - metadataGb);
      logicalGb = usableGb * multiplier;
    }
    
    md += `- **Hardware Controller**: StorageGRID ${ctrl} (${totalNodes} Nodes)\n`;
    if (!isComputeOnly) {
      md += `- **Drive Configuration**: ${diskCount}x ${state.sizing.diskSize} drives per node (Total ${diskCount * totalNodes} disks, ${state.sizing.shelfType} Shelves)\n`;
      md += `- **Sizing Capacity Details**:\n`;
      md += `  - *Total Raw Capacity*: **${formatCapacity(rawGb)}**\n`;
      md += `  - *DDP Parity Overhead*: ${formatCapacity(parityGb)} (2 drives per physical node)\n`;
      md += `  - *DDP Spare Overhead*: ${formatCapacity(spareGb)} (2 drives per physical node)\n`;
      md += `  - *Cassandra Metadata & OS Reserve (15%)*: ${formatCapacity(metadataGb)}\n`;
      md += `  - *NetApp Usable Physical Capacity*: **${formatCapacity(usableGb)}**\n`;
      md += `  - *ILM Efficiency Multiplier*: **${ratioText}**\n`;
      md += `  - *Effective Logical Capacity*: **${formatCapacity(logicalGb)}**\n`;
    } else {
      md += `- **Node Role**: Services Appliance / Compute Gateway Only (0 GB object storage capacity)\n`;
    }
  }
  md += `- **Switching Fabric**: ${state.network.switchBrand.toUpperCase()} (Port Speed: ${state.network.portSpeed} Gb/s, MTU: ${state.network.mtu})\n\n`;

  if (state.platform === "ontap") {
    md += `### Resource Table\n`;
    md += `| Volume Name | SVM Owner | Aggregate | Size | Est. IOPS | NVE Encryption | FabricPool Policy |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    state.volumes.forEach(v => {
      let fpPolicy = v.fabricpool || "none";
      if (fpPolicy === true) fpPolicy = "auto";
      if (fpPolicy === false) fpPolicy = "none";
      md += `| ${v.name} | ${v.svmName} | ${v.aggregate} | ${v.size} ${v.sizeUnit} | ${v.iops || 1000} | ${v.encryption ? 'Enabled' : 'Disabled'} | ${fpPolicy.toUpperCase()} |\n`;
    });
    md += `\n`;
    
    if (state.ontapFabricPool.enabled) {
      md += `### FabricPool Cloud Tier Target\n`;
      md += `- **StorageGRID Endpoint**: \`${state.ontapFabricPool.endpoint}:${state.ontapFabricPool.port}\`\n`;
      md += `- **Target Bucket**: \`${state.ontapFabricPool.bucket}\`\n`;
      md += `- **SSL Validation**: ${state.ontapFabricPool.sslEnabled ? "Enabled" : "Disabled (Warning: Insecure)"}\n\n`;
    }

    md += `### Physical Cabling Topology\n`;
    md += `The physical port wiring matrix for cluster interconnect, storage shelves, management, and data access:\n\n`;
    md += `| Source Device | Source Port | Destination Device | Destination Port | Link Description |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    
    const cablingRows = generateCablingRows();
    cablingRows.forEach(r => {
      md += `| ${r.src} | ${r.srcPort} | ${r.dest} | ${r.destPort} | ${r.type} |\n`;
    });
    md += `\n`;
  } else {
    md += `### StorageGRID Tenants\n`;
    md += `| Tenant Name | Logical Quota | Sites | ILM Policy | Est. Physical Space | Protocol | Platform Services |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    state.sgTenants.forEach(t => {
      const phys = calculateTenantPhysicalGb(t.quota || 0, t.sites || 1, t.ilmPolicy || "2_copies");
      md += `| ${t.name} | ${t.quota ? t.quota + ' GB' : 'Unlimited'} | ${t.sites || 1} | ${t.ilmPolicy || "2_copies"} | ${formatCapacity(phys)} | ${t.protocol.toUpperCase()} | ${t.allowPlatformServices ? 'Allowed' : 'Disabled'} |\n`;
    });
    md += `\n`;
    
    md += `### S3 Buckets\n`;
    md += `| Bucket Name | Owner Tenant | Region | Versioning | Object Lock | Platform Services |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    state.sgBuckets.forEach(b => {
      const services = [];
      if (b.eventNotifications) services.push("SNS");
      if (b.cloudMirror) services.push("CloudMirror");
      if (b.searchIntegration) services.push("Elasticsearch");
      const serviceStr = services.length > 0 ? services.join(", ") : "None";
      const lockStr = b.objectLock ? `Enabled (${b.retentionDays} Days)` : "Disabled";
      md += `| ${b.name} | ${b.tenantName} | ${b.region} | ${b.versioning ? 'Enabled' : 'Disabled'} | ${lockStr} | ${serviceStr} |\n`;
    });
    md += `\n`;

    md += `### Physical Cabling Topology\n`;
    md += `The physical port wiring matrix for StorageGRID admin, grid, and client networks:\n\n`;
    md += `| Source Device | Source Port | Destination Device | Destination Port | Link Description |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    
    const cablingRows = generateCablingRows();
    cablingRows.forEach(r => {
      md += `| ${r.src} | ${r.srcPort} | ${r.dest} | ${r.destPort} | ${r.type} |\n`;
    });
    md += `\n`;
  }

  md += `## 2. Best Practice Engineering Justifications\n`;
  
  if (state.platform === "ontap") {
    md += `### Hardware Platform Profile: ${platformLabel}\n`;
    if (state.ontapPlatform === "asa") {
      md += `- **SAN Optimization**: The All-Flash SAN Array (ASA) is configured for block-only storage. Paths operate in active-active configurations, delivering sub-millisecond host failover recovery.\n`;
    } else if (state.ontapPlatform === "aff") {
      md += `- **Unified Storage**: NetApp AFF handles unified workloads. Inline deduplication and background compaction ensure optimal SSD utilization across file and block directories.\n`;
    } else if (state.ontapPlatform === "afx") {
      md += `- **Hybrid Tiering**: FAS / AFX hybrid systems tier cold blocks to external object storage (FabricPool) while keeping active filesystem metadata on high-performance SSD caches.\n`;
    }
    
    if (state.ontapFabricPool.enabled) {
      const provider = state.ontapFabricPool.providerType || "SG";
      md += `### FabricPool Cloud Tiering (Source & Destination Guide)\n`;
      md += `FabricPool is configured to tier cold data blocks from local performance aggregates to an external object store tier. This deployment uses **${provider}** as the capacity tier target.\n\n`;
      md += `#### 1. Destination Configuration Checklist (${provider} Side):\n`;
      md += `- **Tenant Account**: Configure a dedicated S3 tenant account (e.g. \`FabricPool-Tenant\`) with platform services enabled.\n`;
      md += `- **IAM User & Keys**: Set up an IAM user with S3 management privileges and generate an Access Key ID and Secret Access Key. Record these credentials.\n`;
      md += `- **S3 Bucket**: Create the target bucket/container named \`${state.ontapFabricPool.bucket}\`.\n`;
      md += `  - **IMPORTANT**: Disable bucket versioning and object lifecycle policies on this bucket. FabricPool manages its own block allocation and versioning; enabling S3-side versioning will cause rapid, irreversible capacity consumption.\n`;
      md += `- **Networking & Load Balancer**: Set up a High Availability (HA) VIP and Load Balancer endpoint on port \`${state.ontapFabricPool.port}\` to distribute tiering requests across nodes.\n\n`;
      md += `#### 2. Source Configuration Checklist (ONTAP Side):\n`;
      md += `- **DNS Resolution**: Nodes must be able to resolve the FQDN \`${state.ontapFabricPool.endpoint}\` on their management and data LIFs.\n`;
      if (state.ontapFabricPool.sslEnabled) {
        md += `- **CA Certificate Installation**: Trust the destination S3 server's SSL certificate by installing its root CA certificate on the ONTAP cluster admin vserver.\n`;
      }
      md += `- **Object Store Registration**: Define the cloud tier target using \`object-store config create\` with the access credentials.\n`;
      md += `- **Aggregate Attachment**: Attach the object store configuration to performance aggregates via \`storage aggregate object-store attach\`.\n`;
      md += `- **Volume Tiering Policies**: Configure tiering policies per volume using \`volume modify -tiering-policy <policy> [-tiering-minimum-cooling-days <days>]\`.\n\n`;
      md += `#### 3. FabricPool Volume Tiering Policies:\n`;
      md += `- **None**: No data is tiered to the cloud (default for performance-sensitive write-intensive databases).\n`;
      md += `- **Snapshot-Only (snapshot-only)**: Tiers only cold blocks associated with snapshots. Highly recommended for volumes with high snapshot retention.\n`;
      md += `- **Auto (auto)**: Tiers cold blocks from both active filesystem and snapshots. The default cooling period is 31 days (adjustable per-volume).\n`;
      md += `- **All (all)**: Tiers all user data blocks (both read and write) immediately, keeping only metadata local. Ideal for archives.\n`;
      md += `- **Backup (backup)**: Tiers all data blocks immediately on data-protection (DP) volumes (useful for secondary backup targets).\n\n`;
    }

    if (state.qos.policyType !== "none") {
      md += `### Storage Quality of Service (QoS) & Throttling Best Practices\n`;
      md += `- **Workload Isolation**: Utilizing QoS policy groups isolates critical workloads from "noisy neighbors" to prevent performance degradation.\n`;
      if (state.qos.policyType === "shared") {
        md += `- **Shared Ceiling**: A shared limit of **${state.qos.peakIops} IOPS** and **${state.qos.peakThroughput} MB/s** ensures the combined consumption of all volumes in the group does not exceed fabric bandwidth capacity.\n`;
      } else if (state.qos.policyType === "non_shared") {
        md += `- **Non-Shared Ceiling**: A non-shared ceiling of **${state.qos.peakIops} IOPS** and **${state.qos.peakThroughput} MB/s** is applied to each volume individually, enforcing strict limits per volume.\n`;
      } else if (state.qos.policyType === "adaptive") {
        md += `- **Adaptive Throttling**: The policy scales throughput dynamically based on volume size: **${state.qos.allocatedIops} expected IOPS/TB** and **${state.qos.peakIopsPerTb} peak IOPS/TB** with an absolute floor of **${state.qos.absoluteMinIops} IOPS** to guarantee base performance as space grows.\n`;
      }
      if (state.qos.expectedIops > 0) {
        md += `- **Minimum Performance Guarantees (Floor)**: An expected limit of **${state.qos.expectedIops} IOPS** guarantees critical performance SLA is met even during peak cluster workload periods.\n`;
      }
      md += `\n`;
    }

    // Database Justification
    if (db !== "none") {
      md += `\n### Database Integration: ${db.toUpperCase()} Profile\n`;
      if (db === "oracle") {
        md += `- **ASM Separation**: Redo logs are split onto dedicated high-speed low-latency aggregates (\`vol_oracle_redo\`) separate from tablespace data (\`vol_oracle_data\`) to isolate intense random writes and prevent log-writer latency spikes.\n`;
        md += `- **Encryption**: NetApp Volume Encryption (NVE) secures the ASM database volumes at rest with zero software performance overhead, using hardware-accelerated AES-256 engines.\n`;
      } 
      else if (db === "mssql") {
        md += `- **LDF & MDF Isolation**: Separate volumes are assigned for Primary MDF tables and Transaction LDF logs to isolate sequential write queues. Best practice dictates formatting MS SQL LUNs with a **64KB Allocation Unit Size** inside NTFS/ReFS.\n`;
        md += `- **TempDB performance**: A dedicated volume is supplied for TempDB to isolate high-temp read/write thrashing.\n`;
      } 
      else if (db === "postgres") {
        md += `- **WAL logs division**: PostgreSQL Write-Ahead Logs (WAL) are written sequentially. Isolating them on a distinct NVMe-backed volume (\`vol_pg_wal\`) keeps log updates fast and reduces wait times on transactions.\n`;
      }
    }

    // Hypervisor Justification
    if (hypervisor !== "none") {
      md += `\n### Virtualization Integration: ${hypervisor.toUpperCase()} Profile\n`;
      if (hypervisor === "esxi") {
        md += `- **NFS Mount Settings**: For VMware ESXi datastores mounting over NFS, always mount using the following options:\n`;
        md += `  \`\`\`\n`;
        md += `  mount -t nfs -o rsize=65536,wsize=65536,hard,proto=tcp,vers=3 192.168.20.21:/vol_data /vmfs/volumes/netapp_ds\n`;
        md += `  \`\`\`\n`;
        md += `- **Jumbo Frames**: MTU 9000 must be enabled end-to-end on vSwitch virtual vmkernel adapters, physical switches, and storage LIFs to reduce CPU overhead during heavy storage transfers.\n`;
      } 
      else if (hypervisor === "hyperv") {
        md += `- **Registry Tuning**: Optimize host registry values on Hyper-V nodes, including setting the iSCSI query timeout to 60 seconds to support high availability storage takeover paths.\n`;
      }
    }
  } else {
    md += `### StorageGRID Grid Architecture Profile\n`;
    md += `- **Multi-Tenancy Isolation**: StorageGRID isolates S3 client namespaces via Tenant accounts. Each tenant gets dedicated local accounts, API keys, and bucket quotas, guaranteeing strict multi-tenant segregation.\n`;
    md += `- **Data Protection & Compliance**: Enabling S3 Object Lock enforces write-once-read-many (WORM) compliance. S3 Versioning ensures file history is preserved and provides defense against ransomware.\n`;
    md += `- **S3 Platform Services**: Event Notifications (SNS/Webhooks) trigger serverless actions; CloudMirror replicates objects to AWS S3 or other storage hosts for disaster recovery; Metadata Search (Elasticsearch) updates external search indexes automatically on write.\n`;
    if (state.version === "12.0") {
      md += `- **Advanced Dataset Copying (Bucket Branches)**: Enables creation of space-efficient point-in-time read-only or read-write bucket clones for isolated AI/ML experiments without duplicating physical storage.\n`;
      if (state.sgIntegrations.s3Caching) {
        md += `- **S3 Caching Layer**: Active caching is configured to accelerate high-throughput read/write transfers for AI/ML dataset ingestion.\n`;
      }
      if (state.sgIntegrations.assumeRole) {
        md += `- **Assume Role Access Control**: Employs AWS STS-compatible AssumeRole API for issuing temporary S3 credentials.\n`;
      }
    }
    md += `- **High Availability Load Balancing**: Grid Gateway nodes are grouped into an Active-Active or Active-Backup VIP configuration (HA Groups). The Load Balancer Endpoint opens a secure listening port (e.g. ${state.sgIntegrations.lbPort || 10443}) routing traffic to active interfaces with minimal latency.\n`;
    md += `- **Information Lifecycle Management (ILM)**: The ILM replication policy (configured as \`${state.sgIntegrations.ilmPolicy.toUpperCase()}\`) defines how S3 objects are protected across storage nodes globally.\n`;
  }

  md += `\n## 3. Step-by-Step Implementation Sequence\n`;
  if (state.platform === "ontap") {
    md += `1. **Switch Zoning Setup**: Configure zoning aliases on your Cisco/Brocade switch using the scripts in \`switch_config.txt\`.\n`;
    md += `2. **Cluster Peering / SVM Setup**: Log into the NetApp CLI and execute commands from \`ontap_cli_config.txt\` to build SVM virtual servers and configure network interfaces.\n`;
    if (state.ontapFabricPool.enabled) {
      md += `3. **FabricPool Target Configuration**: Define the StorageGRID S3 target cloud tier on ONTAP, attach the object store to the SSD aggregates, and configure the custom tiering policies per volume.\n`;
    }
    md += `${state.ontapFabricPool.enabled ? '4' : '3'}. **Storage Provisioning**: Execute the Ansible Playbook \`ansible_playbook.yaml\` to automate the deployment of volumes, Snapshot schedules, and efficiency engines.\n`;
    if (state.trident.enabled) {
      md += `${state.ontapFabricPool.enabled ? '5' : '4'}. **Kubernetes Integration**: Deploy Trident driver configs using \`kubectl apply -f trident_config.yaml\` to enable dynamic container PVC bindings.\n`;
    }
  } else {
    md += `1. **Network Infrastructure**: Provision VLAN ${state.network.vlanId} and enable MTU 9000 on the network switch fabric interfaces using the commands in \`switch_config.txt\`.\n`;
    md += `2. **Grid Gateway and HA**: Configure the High Availability Group (\`${state.sgIntegrations.haGroupName || 'ha-gateway-group'}\`) and assign the Virtual IP (\`${state.sgIntegrations.haVip || '192.168.10.50'}\`) across nodes.\n`;
    md += `3. **Load Balancer Endpoint**: Create the S3 Load Balancer Endpoint on port \`${state.sgIntegrations.lbPort || 10443}\` bound to the HA group with secure certificates.\n`;
    md += `4. **Provision S3 Tenant Accounts**: Run the curl scripts in \`storagegrid_cli_config.txt\` or run the Ansible playbook to create the tenants with S3 permissions and size quotas.\n`;
    md += `5. **Provision S3 Buckets**: Define buckets under their respective tenants. Apply Object Lock retention periods, enable versioning, and configure S3 Platform Services endpoints.\n`;
  }

  md += `\n`;
  md += generateNetworkTrafficMatrix("markdown");

  return md;
}

function updateCodePreview() {
  const activeTabEl = document.querySelector(".preview-tab.active");
  if (!activeTabEl) return;
  const currentTab = activeTabEl.id;
  const previewCodeElement = document.getElementById("previewCodeElement");
  const previewCodeFilename = document.getElementById("previewCodeFilename");

  let generatedText = "";
  let filename = "ontap_cli_config.txt";
  let langClass = "language-bash";

  if (currentTab === "tabCode") {
    if (state.platform === "storagegrid") {
      generatedText = generateStoragegridCliCode();
      filename = "storagegrid_cli_config.txt";
    } else {
      generatedText = generateOntapCliCode();
      filename = "ontap_cli_config.txt";
    }
  } 
  else if (currentTab === "tabSwitch") {
    generatedText = generateSwitchConfig();
    filename = "switch_config.txt";
    langClass = "language-bash";
  }
  else if (currentTab === "tabAnsible") {
    generatedText = generateAnsiblePlaybook();
    filename = "ansible_playbook.yaml";
    langClass = "language-yaml";
  }
  else if (currentTab === "tabTrident") {
    generatedText = generateTridentConfig();
    filename = "trident_config.yaml";
    langClass = "language-yaml";
  }
  else if (currentTab === "tabGuide") {
    generatedText = generateDeploymentGuide();
    filename = "deployment_guide.md";
    langClass = "language-markdown";
  }
  else if (currentTab === "tabVariables") {
    generatedText = JSON.stringify(state, null, 2);
    filename = "summary.json";
    langClass = "language-json";
  } 
  else if (currentTab === "tabValidation") {
    const items = validateForm();
    generatedText = `# Form Field Validations Logs\n# Errors: ${items.errors.length} | Warnings: ${items.warnings.length}\n\n`;
    
    if (items.errors.length === 0) {
      generatedText += `[✓] All required form fields validated successfully!\n`;
    } else {
      generatedText += `[✗] The following form errors need resolution before building:\n`;
      items.errors.forEach(e => generatedText += `- ERROR: ${e.msg}\n`);
    }

    if (items.warnings.length > 0) {
      generatedText += `\n[!] Warnings:\n`;
      items.warnings.forEach(w => generatedText += `- WARNING: ${w.msg}\n`);
    }
    
    filename = "validation_report.txt";
  }
  else if (currentTab === "tabProposal") {
    generatedText = generatePresalesProposalMarkdown();
    filename = "presales_proposal.md";
    langClass = "language-markdown";
  }

  previewCodeFilename.innerText = filename;
  previewCodeElement.className = `${langClass} code-pre`;
  previewCodeElement.textContent = generatedText;
  
  safeHighlightElement(previewCodeElement);

  // Re-render HTML guide view or proposal if active
  if (currentTab === "tabGuide") {
    renderArchitectureGuide();
  } else if (currentTab === "tabProposal") {
    renderPresalesProposal();
  }
}

function copyPreviewCode() {
  const codeText = document.getElementById("previewCodeElement").textContent;
  navigator.clipboard.writeText(codeText).then(() => {
    const copyBtn = document.getElementById("btnCopyPreviewCode");
    copyBtn.innerHTML = `<i data-lucide="check" style="width: 14px; height: 14px; color: var(--color-success);"></i> Copied!`;
    safeCreateIcons();
    setTimeout(() => {
      copyBtn.innerHTML = `<i data-lucide="copy" style="width: 14px; height: 14px;"></i> Copy`;
      safeCreateIcons();
    }, 2000);
  });
}

// 12. VALIDATION ENGINE
function validateForm() {
  const errors = [];
  const warnings = [];

  const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const wwpnPattern = /^([0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}$/;
  const iqnPattern = /^iqn\.\d{4}-\d{2}\.[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+$/;

  if (state.platform === "ontap") {
    // Greenfield Sizing & Capacity validations [NEW]
    if (state.mode === "greenfield") {
      const isSsd = state.sizing.shelfType === "NS224" || state.sizing.shelfType === "DS224C";
      const rgSize = state.sizing.raidGroupSize;
      
      // Hard RAID Group limits and disk count checks [NEW]
      const raidType = state.sizing.raidType;
      const minRgSize = raidType === "raid_dp" ? 3 : 4;
      const maxRgSize = raidType === "raid_dp" ? 28 : 29;
      const raidLabel = raidType === "raid_dp" ? "RAID-DP" : "RAID-TEC";
      
      if (rgSize < minRgSize) {
        errors.push({
          step: 1,
          title: "RAID Group Size Too Small",
          msg: `RAID Group Size (${rgSize}) is too small. ${raidLabel} requires a minimum size of ${minRgSize} disks (including parity).`,
          why: `${raidLabel} uses ${raidType === "raid_dp" ? "2" : "3"} dedicated parity disks. To have at least 1 data disk, you must allocate at least ${minRgSize} disks in a group.`,
          fix: `Increase the RAID Group Size to at least ${minRgSize} on Step 1.`
        });
      } else if (rgSize > maxRgSize) {
        errors.push({
          step: 1,
          title: "RAID Group Size Exceeds Limit",
          msg: `RAID Group Size (${rgSize}) is too large. ${raidLabel} supports a maximum group size of ${maxRgSize} disks.`,
          why: `Configuring RAID groups beyond ${maxRgSize} drives increases reconstruction times and probability of multi-drive failure during rebuilds beyond standard protection limits.`,
          fix: `Reduce the RAID Group Size to ${maxRgSize} or less on Step 1.`
        });
      }

      const totalDisks = state.sizing.diskCount * (state.sizing.nodeCount / 2);
      const disksPerAggr = totalDisks / 2;
      if (disksPerAggr < minRgSize) {
        errors.push({
          step: 1,
          title: "Insufficient Disks for Aggregate creation",
          msg: `The configuration allocates only ${disksPerAggr.toFixed(1)} disks per aggregate, but ${raidLabel} requires a minimum of ${minRgSize} disks per aggregate.`,
          why: `An aggregate is created per controller node. Each aggregate must have enough disks to meet the RAID type minimum disk requirement (${minRgSize} disks).`,
          fix: `Increase the Disk Count on Step 1 to allocate at least ${minRgSize * 2} disks per HA node-pair.`
        });
      }

      
      if (isSsd) {
        if (rgSize < 20 || rgSize > 28) {
          warnings.push({
            step: 1,
            title: "Non-Optimal RAID Group Size",
            msg: `RAID Group Size (${rgSize}): SSD aggregates perform best with RAID group sizes between 20 and 28.`,
            why: "Larger groups minimize parity overhead, while SSD reliability mitigates double-parity rebuild risk.",
            fix: "Adjust RAID Group Size to be between 20 and 28 on Step 1."
          });
        }
      } else {
        if (rgSize < 12 || rgSize > 20) {
          warnings.push({
            step: 1,
            title: "Non-Optimal RAID Group Size",
            msg: `RAID Group Size (${rgSize}): HDD aggregates perform best with RAID group sizes between 12 and 20.`,
            why: "Smaller group sizes reduce rebuild times and limit probability of multi-drive failure during rebuilds.",
            fix: "Adjust RAID Group Size to be between 12 and 20 on Step 1."
          });
        }
      }

      if (state.sizing.spareDisks === 0) {
        warnings.push({
          step: 1,
          title: "Zero Spare Disks Configured",
          msg: "Zero spares configured. NetApp best practice requires at least 1-2 spare disks per pool for hot-replacement.",
          why: "If a drive fails and there are no hot spares, the aggregate operates in a degraded state until a physical replacement is inserted, increasing risk of data loss.",
          fix: "Set Spare Disks to 1 or 2 on Step 1."
        });
      } else if (state.sizing.spareDisks > 4) {
        warnings.push({
          step: 1,
          title: "Excessive Spares Configured",
          msg: `Spare Disks (${state.sizing.spareDisks}): Configuring more than 4 spares might be unnecessary.`,
          why: "Spares consume physical capacity that could otherwise be allocated to usable data tiers.",
          fix: "Reduce Spare Disks count to 1 or 2 on Step 1."
        });
      }

      // Cabling shelf counts checks [NEW]
      const shelfCount = Math.ceil(state.sizing.diskCount / 24);
      if (state.sizing.shelfType === "NS224" && shelfCount > 2) {
        warnings.push({
          step: 7,
          title: "High Shelf Count for Direct Cabling",
          msg: `NS224 Shelves (${shelfCount}): Direct cabling more than 2 NS224 shelves requires additional PCIe NVMe expansion adapters.`,
          why: "Standard controller cards have limited ports. For configurations exceeding 2 shelves, switched storage fabric is recommended.",
          fix: "Verify you have enough onboard or adapter ports, or consider using a storage switch fabric."
        });
      }

      // Check if total volume size exceeds cluster usable physical capacity [NEW]
      if (state.sizing.usableGb > 0) {
        let totalVolumeGb = 0;
        state.volumes.forEach(vol => {
          let sizeGb = vol.size || 0;
          if (vol.sizeUnit === "TB") sizeGb *= 1000;
          totalVolumeGb += sizeGb;
        });
        if (totalVolumeGb > state.sizing.usableGb) {
          warnings.push({
            step: 4,
            title: "Overprovisioned Cluster Usable Capacity",
            msg: `Total provisioned volume capacity (${formatCapacity(totalVolumeGb)}) exceeds the designed physical usable cluster capacity (${formatCapacity(state.sizing.usableGb)}).`,
            why: "NetApp ONTAP supports thin provisioning (overprovisioning), but if host applications write more data than the physical aggregates can store, aggregates will run out of space and take volumes offline.",
            fix: "Increase node/drive specifications in Step 1 or reduce volume sizes in Step 4."
          });
        }
      }
    }

    // MetroCluster Validation Rules
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      
      // Latency limit check (blocking error)
      if (mcc.latency > 10) {
        errors.push({
          step: 1,
          title: "MetroCluster Latency Limit Exceeded",
          msg: `Round-Trip Latency (${mcc.latency} ms) exceeds the 10 ms maximum synchronous replication threshold.`,
          why: "Synchronous mirroring requires latency to be strictly below 10 ms RTT (ideally < 5 ms) to prevent application write timeouts and database write stalls.",
          fix: "Verify inter-site dark fiber route latency, or switch to an asynchronous replication protocol (SnapMirror) rather than MetroCluster."
        });
      }
      
      // Distance limits check (warning)
      if (mcc.type === "ip" && mcc.distance > 700) {
        warnings.push({
          step: 1,
          title: "MetroCluster IP Distance Boundary Alert",
          msg: `Site Distance (${mcc.distance} km) exceeds the standard 700 km limit for MetroCluster IP.`,
          why: "Although MetroCluster IP is highly scalable, distances exceeding 700 km typically introduce latency exceeding standard synchronous write thresholds.",
          fix: "Review latency values and consult with NetApp engineering for a certified custom design."
        });
      } else if (mcc.type === "fc" && mcc.distance > 300) {
        warnings.push({
          step: 1,
          title: "MetroCluster FC Distance Boundary Alert",
          msg: `Site Distance (${mcc.distance} km) exceeds the 300 km physical limit for MetroCluster FC.`,
          why: "MetroCluster FC uses Fibre Channel fabric extensions which physically limit operations to a maximum of 300 km even with dedicated amplification.",
          fix: "Reduce inter-site distance, leverage FC-to-IP routers, or deploy MetroCluster IP instead."
        });
      }
      
      // Node count alignment check (warning)
      const scaleNodeCount = parseInt(mcc.scale);
      if (state.sizing.nodeCount !== scaleNodeCount) {
        warnings.push({
          step: 1,
          title: "Cluster Node Count Mismatch",
          msg: `The designed cluster node count (${state.sizing.nodeCount}) does not match the MetroCluster Scale specification (${mcc.scale}-Node).`,
          why: `A MetroCluster configuration requires symmetric node counts across both locations. A ${mcc.scale}-Node MetroCluster requires exactly ${mcc.scale} nodes in total.`,
          fix: `Synchronize the Node Count dropdown under Step 1 to ${mcc.scale} nodes.`
        });
      }
      
      // Switch type compatibility checks (warning)
      const switchBrand = state.network.switchBrand;
      if (mcc.type === "ip" && switchBrand === "brocade") {
        warnings.push({
          step: 1,
          title: "Switch Fabric Compatibility Alert",
          msg: "MetroCluster IP is configured, but Brocade SAN Fibre Channel switches are selected under Step 6.",
          why: "MetroCluster IP requires compatible high-speed Ethernet switches (e.g. Cisco Nexus or Broadcom switches) to transport IP traffic, and is incompatible with Brocade Fibre Channel switches.",
          fix: "Change the switch brand in Step 6 to Cisco or Generic Ethernet."
        });
      } else if (mcc.type === "fc" && switchBrand !== "brocade") {
        warnings.push({
          step: 1,
          title: "Switch Fabric Compatibility Alert",
          msg: "MetroCluster FC is configured, but Cisco or Generic switches are selected under Step 6.",
          why: "MetroCluster FC requires Brocade Fibre Channel fabric switches (Fabric OS) for FC-VI virtual interface replication and optical disk loop routing.",
          fix: "Change the switch brand in Step 6 to Brocade."
        });
      }
    }

    // Validate SVM array
    state.svms.forEach((svm, index) => {
      if (!svm.name.trim()) {
        errors.push({
          step: 3,
          title: "Missing SVM Name",
          msg: `SVM #${index + 1}: Name is required.`,
          why: "ONTAP requires a valid name for each Storage Virtual Machine to establish a logical namespace and allow management referencing.",
          fix: "Enter a unique, non-empty name for the SVM on Step 3."
        });
      } else if (/\s/.test(svm.name)) {
        errors.push({
          step: 3,
          title: "Invalid SVM Name Spaces",
          msg: `SVM #${index + 1}: Name cannot contain spaces.`,
          why: "ONTAP SVM names must comply with standard CLI namespace constraints and cannot contain space characters.",
          fix: "Remove any space characters from the SVM name on Step 3."
        });
      }
      if (!svm.dataIp.trim()) {
        errors.push({
          step: 3,
          title: "Missing SVM Data IP",
          msg: `SVM "${svm.name}": IP address is required.`,
          why: "A data Logical Interface (LIF) IP address is required to allow hosts to connect to and mount shares from this SVM.",
          fix: "Specify a valid IP address for the data LIF on Step 3."
        });
      } else if (!ipPattern.test(svm.dataIp)) {
        errors.push({
          step: 3,
          title: "Invalid SVM Data IP Format",
          msg: `SVM "${svm.name}": Data IP has an invalid format.`,
          why: "The entered string is not a valid IPv4 address. Host connections require a standard IPv4 address to route traffic.",
          fix: "Correct the IP address format (e.g. 192.168.20.21) on Step 3."
        });
      }
    });

    // Validate Volumes array
    state.volumes.forEach((vol, index) => {
      if (!vol.name.trim()) {
        errors.push({
          step: 4,
          title: "Missing Volume Name",
          msg: `Volume #${index + 1}: Name is required.`,
          why: "Each FlexVol must have a name to be mapped to junctions, export policies, or target SAN igroups.",
          fix: "Provide a unique name for the volume on Step 4."
        });
      } else if (/\s/.test(vol.name)) {
        errors.push({
          step: 4,
          title: "Invalid Volume Name Spaces",
          msg: `Volume #${index + 1}: Name cannot contain spaces.`,
          why: "ONTAP volume naming conventions prohibit spaces to prevent shell syntax issues in CLI commands and scripts.",
          fix: "Remove spaces from the volume name on Step 4."
        });
      }
      if (!vol.aggregate.trim()) {
        errors.push({
          step: 4,
          title: "Missing Target Aggregate",
          msg: `Volume "${vol.name}": Target Aggregate is required.`,
          why: "A volume must reside on a physical storage pool (aggregate). An aggregate provides the underlying RAID group disks.",
          fix: "Specify a target aggregate (e.g., aggr1) for the volume on Step 4."
        });
      }
      if (!vol.size || vol.size <= 0) {
        errors.push({
          step: 4,
          title: "Invalid Volume Size",
          msg: `Volume "${vol.name}": Size must be a positive number.`,
          why: "Storage volume allocations require a positive logical block address (LBA) capacity greater than zero.",
          fix: "Enter a valid positive number for the volume capacity on Step 4."
        });
      }

      // Vol size limit check
      if (vol.sizeUnit === "TB" && vol.size > 100) {
        warnings.push({
          step: 4,
          title: "Large FlexVol Size Recommendation",
          msg: `Volume "${vol.name}": Size exceeds 100 TB. NetApp recommends using FlexGroup rather than FlexVol for capacities above 100 TB.`,
          why: "FlexVols are capped and show reduced management performance at massive scales. FlexGroups distribute directories across multiple member constituents.",
          fix: "Consider breaking this into multiple volumes, or convert to a FlexGroup structure in ONTAP."
        });
      }

      // Vol IOPS limits check
      const volIops = vol.iops || 0;
      if (state.ontapPlatform === "afx" && volIops > 5000) {
        warnings.push({
          step: 4,
          title: "Performance Constraint Warning",
          msg: `Volume "${vol.name}": Required IOPS (${volIops}) is high for FAS hybrid systems. Upgrading to NetApp AFF or ASA is recommended.`,
          why: "FAS arrays utilize spinning disks with SSD caching. Heavy, high-IOPS random workloads can saturate aggregate read/write buffers.",
          fix: "Upgrade the underlying target hardware platform profile to AFF or ASA for all-flash performance, or lower IOPS expectations."
        });
      }
      if ((state.ontapPlatform === "aff" || state.ontapPlatform === "asa") && volIops > 100000) {
        warnings.push({
          step: 4,
          title: "Extreme IOPS Workload Warning",
          msg: `Volume "${vol.name}": Target IOPS (${volIops}) is extremely high. Ensure active-active multipathing and high-speed links are configured.`,
          why: "A single aggregate link may bottle high-density SSD traffic. Delivering over 100k IOPS requires parallel network connections.",
          fix: "Verify that multi-port LACP or multi-path SAN routes are set up on Step 6."
        });
      }

      // Enforce nested LUNs/Namespaces checks for SAN volumes/protocols
      const isVolSan = vol.type === "san" || (vol.luns && vol.luns.length > 0);
      if (isVolSan) {
        const activeProtos = state.protocols || [state.protocol || "nfs"];
        const isNvme = activeProtos.some(p => p.startsWith("nvme"));
        const unitLabel = isNvme ? "Namespace" : "LUN";
             if (!vol.luns || vol.luns.length === 0) {
          warnings.push({
            step: 4,
            title: `Missing SAN ${unitLabel} Allocation`,
            msg: `Volume "${vol.name}": Volume Type is Block (SAN) but no ${unitLabel}s are defined.`,
            why: "Under block protocols, hosts cannot access raw volumes directly. You must provision logical block units (LUNs or Namespaces) inside the volume.",
            fix: "Click the 'Add LUN / Namespace' button under the volume on Step 4."
          });
        } else {
          let totalLunSize = 0;
          vol.luns.forEach((lun, lunIdx) => {
            if (!lun.name.trim()) {
              errors.push({
                step: 4,
                title: `Missing ${unitLabel} Name`,
                msg: `Volume "${vol.name}" ${unitLabel} #${lunIdx + 1}: Name is required.`,
                why: "Each LUN or Namespace requires a filepath (e.g. /vol/vol_data/lun1) to be recognized and mapped to initiators.",
                fix: "Provide a valid name for the block unit."
              });
            } else if (/\s/.test(lun.name)) {
              errors.push({
                step: 4,
                title: `Invalid ${unitLabel} Name Spaces`,
                msg: `Volume "${vol.name}" ${unitLabel} "${lun.name}": Name cannot contain spaces.`,
                why: "Spaces are prohibited in block unit naming schemes to comply with file path requirements in ONTAP.",
                fix: "Remove space characters from the block unit name."
              });
            }
            if (!lun.size || lun.size <= 0) {
              errors.push({
                step: 4,
                title: `Invalid ${unitLabel} Size`,
                msg: `Volume "${vol.name}" ${unitLabel} "${lun.name}": Size must be a positive number.`,
                why: "Block storages require valid LBA block allocations. Size must be greater than zero.",
                fix: "Correct the size parameter to be a positive number."
              });
            } else {
              totalLunSize += lun.size;
            }
 
            if (lun.sizeUnit === "TB" && lun.size > 16) {
              warnings.push({
                step: 4,
                title: "Large LUN Capacity Warning",
                msg: `Volume "${vol.name}" ${unitLabel} "${lun.name}": Size exceeds 16 TB. Verify client OS support for LUNs > 16 TB.`,
                why: "Some legacy host operating systems or partition maps (like MBR) cannot mount disks larger than 16 TB.",
                fix: "Verify host compliance or split the storage into smaller LUNs."
              });
            }
          });
 
          if (totalLunSize > vol.size) {
            errors.push({
              step: 4,
              title: "Overprovisioned Volume Space",
              msg: `Volume "${vol.name}": Sum of nested ${unitLabel} sizes (${totalLunSize} ${vol.sizeUnit}) exceeds parent volume capacity (${vol.size} ${vol.sizeUnit}).`,
              why: "You cannot create LUNs/Namespaces that collectively require more physical space than their enclosing FlexVol holds.",
              fix: "Increase the parent volume size or reduce the size of the nested LUNs/Namespaces."
            });
          } else if (totalLunSize >= vol.size * 0.95) {
            warnings.push({
              step: 4,
              title: "Insufficient Volume Headroom for LUNs",
              msg: `Volume "${vol.name}": Nested ${unitLabel}s consume ${((totalLunSize / vol.size) * 100).toFixed(0)}% of containing volume capacity (${vol.size} ${vol.sizeUnit}).`,
              why: "ONTAP reserves approximately 1-5% of volume capacity for LUN geometry and file mapping metadata. If the volume size is too close to the LUN size, write operations might fail and force the LUN offline. Snapshot copies will also require additional write headroom.",
              fix: "Increase the parent volume size on Step 4 to be at least 10% (ideally 20%) larger than the sum of its nested LUNs."
            });
          }
        }
      }
    });

    // Aggregate Level Capacity & Overprovisioning Checks [NEW]
    if (state.sizing.usableGb > 0) {
      const singleAggrUsableGb = state.sizing.usableGb / (state.sizing.nodeCount || 2);
      const aggrVolumesMap = {};
      
      state.volumes.forEach(vol => {
        const aggrName = (vol.aggregate || "aggr1").trim();
        let sizeGb = vol.size || 0;
        if (vol.sizeUnit === "TB") sizeGb *= 1000;
        
        if (!aggrVolumesMap[aggrName]) {
          aggrVolumesMap[aggrName] = {
            totalGb: 0,
            vols: []
          };
        }
        aggrVolumesMap[aggrName].totalGb += sizeGb;
        aggrVolumesMap[aggrName].vols.push(vol);
      });
      
      for (const [aggrName, data] of Object.entries(aggrVolumesMap)) {
        // 1. Check if any single volume exceeds the aggregate capacity
        data.vols.forEach(vol => {
          let volSizeGb = vol.size || 0;
          if (vol.sizeUnit === "TB") volSizeGb *= 1000;
          
          if (volSizeGb > singleAggrUsableGb) {
            errors.push({
              step: 4,
              title: "Volume Exceeds Aggregate Capacity",
              msg: `Volume "${vol.name}": Size (${formatCapacity(volSizeGb)}) exceeds target aggregate usable capacity (${formatCapacity(singleAggrUsableGb)}).`,
              why: "A single ONTAP FlexVol must reside entirely within a single aggregate (node-level pool) and cannot span multiple aggregates or controller nodes.",
              fix: "Increase the aggregate capacity by adding more disks/shelves on Step 1, or reduce the size of the volume on Step 4. If this is a very large volume, consider a FlexGroup configuration."
            });
          }
        });
        
        // 2. Check if the sum of volumes in the aggregate exceeds aggregate capacity
        const totalAggrVolGb = data.totalGb;
        const pct = (totalAggrVolGb / singleAggrUsableGb) * 100;
        
        if (totalAggrVolGb > singleAggrUsableGb) {
          warnings.push({
            step: 4,
            title: "Aggregate Space Overprovisioned",
            msg: `Aggregate "${aggrName}": Sum of provisioned volumes (${formatCapacity(totalAggrVolGb)}) is ${pct.toFixed(0)}% of aggregate usable capacity (${formatCapacity(singleAggrUsableGb)}).`,
            why: "Although ONTAP thin provisioning allows overprovisioning, allocating more volume capacity than the aggregate's physical capacity poses a risk of host writes failing if applications consume all physical blocks.",
            fix: "Increase physical capacity in Step 1 by adding more nodes/drives, or reduce the sizes of volumes assigned to this aggregate in Step 4."
          });
        } else if (totalAggrVolGb > singleAggrUsableGb * 0.90) {
          warnings.push({
            step: 4,
            title: "High Aggregate Utilization",
            msg: `Aggregate "${aggrName}": Sum of provisioned volumes (${formatCapacity(totalAggrVolGb)}) consumes ${pct.toFixed(0)}% of aggregate capacity (${formatCapacity(singleAggrUsableGb)}).`,
            why: "NetApp best practice recommends keeping aggregate capacity utilization below 90% (ideally 80-85%) to prevent performance degradation, fragmentation, and ensure space for snapshot metadata.",
            fix: "Add more disks in Step 1 to scale aggregate size, or reduce volume allocations in Step 4."
          });
        }
      }
    }


    // Sizing QoS policy-groups validations [NEW]
    if (state.qos.policyType !== "none") {
      if (state.qos.policyType === "shared" || state.qos.policyType === "non_shared") {
        if (state.qos.peakIops <= 0) {
          errors.push({
            step: 4,
            title: "Invalid QoS Peak IOPS",
            msg: "Peak IOPS limit must be greater than 0 when QoS throttling is enabled.",
            why: "A peak throughput of 0 would throttle the workload completely, preventing client operations.",
            fix: "Provide a valid Peak IOPS limit (e.g. 10000) on Step 4."
          });
        }
        if (state.qos.expectedIops > 0 && state.qos.expectedIops >= state.qos.peakIops) {
          errors.push({
            step: 4,
            title: "QoS Expected exceeds Peak",
            msg: `Expected IOPS Floor (${state.qos.expectedIops}) cannot be greater than or equal to Peak IOPS Ceiling (${state.qos.peakIops}).`,
            why: "The minimum performance guarantee (floor) cannot exceed the maximum limit (ceiling).",
            fix: "Decrease Expected IOPS or increase Peak IOPS on Step 4."
          });
        }
        if (state.qos.expectedIops > 50000) {
          warnings.push({
            step: 4,
            title: "Very High QoS Floor",
            msg: `Expected IOPS Floor (${state.qos.expectedIops}) is very high.`,
            why: "Configuring very high QoS floors can cause system scheduling delays if the hardware is overprovisioned.",
            fix: "Verify controller performance limits can support this floor."
          });
        }
      } else if (state.qos.policyType === "adaptive") {
        if (state.qos.allocatedIops >= state.qos.peakIopsPerTb) {
          errors.push({
            step: 4,
            title: "Adaptive QoS Floor exceeds Ceiling",
            msg: `Expected IOPS/TB (${state.qos.allocatedIops}) cannot exceed Peak IOPS/TB (${state.qos.peakIopsPerTb}).`,
            why: "Adaptive floors must scale below ceilings to allow performance headroom.",
            fix: "Ensure Expected IOPS/TB is lower than Peak IOPS/TB on Step 4."
          });
        }
        if (state.qos.absoluteMinIops <= 0) {
          errors.push({
            step: 4,
            title: "Invalid Absolute Minimum IOPS",
            msg: "Absolute Minimum IOPS must be greater than 0.",
            why: "Adaptive policy requires a baseline performance floor for very small volumes.",
            fix: "Set Absolute Minimum IOPS to at least 75 on Step 4."
          });
        }
      }
    }

    // ASA platform protocol verification
    if (state.ontapPlatform === "asa" && !isSanProtocol(state.protocol)) {
      errors.push({
        step: 1,
        title: "Platform Protocol Mismatch",
        msg: "NetApp ASA (All-Flash SAN Array) is block-only. File/Object protocols (NFS, SMB, S3) are not supported. Switch to a SAN protocol (iSCSI, FC, FCoE, NVMe).",
        why: "NetApp ASA controllers are hardware-tuned and software-restricted to SAN block protocols for optimized low-latency failover speeds.",
        fix: "Select a SAN protocol (e.g. iSCSI, FC) on Step 1, or change the hardware platform profile to AFF."
      });
    }

    // FAS platform warnings
    if (state.ontapPlatform === "afx") {
      if (state.protocol.startsWith("nvme")) {
        warnings.push({
          step: 1,
          title: "Suboptimal Protocol Recommendation",
          msg: "NVMe protocols are not recommended for FAS hybrid systems. Use NetApp AFF or ASA for NVMe performance.",
          why: "NVMe protocols require high-throughput backplanes and direct flash storage to deliver latency benefits. Spinners/caching bottle NVMe benefits.",
          fix: "Change protocol to iSCSI or FC on Step 1, or change the hardware profile to AFF/ASA."
        });
      }
      if (state.workload.db !== "none" || state.workload.hypervisor === "esxi") {
        warnings.push({
          step: 5,
          title: "Platform Workload Match Info",
          msg: "FAS is capacity-optimized hybrid storage. For high-performance database workloads (Oracle/SQL) or virtualization, NetApp AFF or ASA is recommended.",
          why: "Database random write logs and VM datastores are highly sensitive to seek latencies. SAS/SATA drives introduce rotational delay.",
          fix: "Confirm if hybrid storage performance fits your Service Level Agreements (SLA), or switch to All-Flash."
        });
      }
    }
  } else {
    // StorageGRID Platform validation
    
    // 0. StorageGRID node count validation [NEW]
    if (state.sizing.nodeCount < 3) {
      warnings.push({
        step: 1,
        title: "Suboptimal StorageGRID Node Count",
        msg: `Configured node count (${state.sizing.nodeCount}) is below recommended production levels.`,
        why: "StorageGRID deployments typically require at least 3 storage nodes to support basic 2-Copy replication rules and metadata redundancy. Run-time node failures in a 1 or 2 node grid can cause permanent data unavailability.",
        fix: "Increase the StorageGRID Node Count to 3 or more on Step 1."
      });
    }

    // 1. Validate Tenants
    const tenantNames = new Set();
    state.sgTenants.forEach((tenant, idx) => {
      const name = tenant.name.trim();
      if (!name) {
        errors.push({
          step: 3,
          title: "Missing Tenant Name",
          msg: `StorageGRID Tenant #${idx + 1}: Tenant Name is required.`,
          why: "StorageGRID separates accounts by tenant spaces. Each tenant requires a name to generate its access credentials and portal login.",
          fix: "Enter a valid tenant name on Step 3."
        });
      } else {
        if (/\s/.test(name)) {
          errors.push({
            step: 3,
            title: "Invalid Tenant Name Spaces",
            msg: `StorageGRID Tenant "${name}": Name cannot contain spaces.`,
            why: "Tenant names are used in S3 DNS endpoints and access structures. Spaces will violate URI and DNS routing patterns.",
            fix: "Remove spaces from the tenant name."
          });
        }
        if (tenantNames.has(name)) {
          errors.push({
            step: 3,
            title: "Duplicate Tenant Name",
            msg: `StorageGRID Tenant "${name}": Tenant name must be unique.`,
            why: "Each tenant account name must be unique across the grid deployment to prevent routing and accounting collisions.",
            fix: "Modify the duplicate name to ensure uniqueness."
          });
        }
        tenantNames.add(name);
      }
    });

    // 2. Validate Buckets
    const bucketNames = new Set();
    state.sgBuckets.forEach((bucket, idx) => {
      const name = bucket.name.trim();
      if (!name) {
        errors.push({
          step: 4,
          title: "Missing Bucket Name",
          msg: `S3 Bucket #${idx + 1}: Name is required.`,
          why: "An S3 bucket cannot be provisioned without a name. It defines the namespace where objects are addressed.",
          fix: "Provide a name for the S3 bucket on Step 4."
        });
      } else {
        if (/[A-Z]/.test(name)) {
          warnings.push({
            step: 4,
            title: "Non-Compliant DNS Bucket Name",
            msg: `S3 Bucket "${name}": Bucket Name contains uppercase characters. DNS compliance recommends lowercase only.`,
            why: "Case restrictions prevent domain resolution lookup warnings when S3 requests are resolved.",
            fix: "Convert the bucket name to all lowercase characters."
          });
        }
        if (/[^a-zA-Z0-9.-]/.test(name)) {
          errors.push({
            step: 4,
            title: "Invalid Bucket Characters",
            msg: `S3 Bucket "${name}": Bucket Name contains invalid characters. Use lowercase, numbers, hyphens, and periods only.`,
            why: "S3 buckets map directly to internet subdomains. Special characters (except hyphens and periods) are prohibited by RFC DNS rules.",
            fix: "Remove special characters from the bucket name."
          });
        }
        if (bucketNames.has(name)) {
          errors.push({
            step: 4,
            title: "Duplicate S3 Bucket Name",
            msg: `S3 Bucket "${name}": S3 Bucket name must be unique across the grid.`,
            why: "S3 bucket namespaces are global within the StorageGRID. Collisions will block bucket creation on the grid nodes.",
            fix: "Enter a unique S3 bucket name."
          });
        }
        bucketNames.add(name);

        // Check Owner Tenant exists
        if (!tenantNames.has(bucket.tenantName)) {
          errors.push({
            step: 4,
            title: "Orphaned S3 Bucket Tenant",
            msg: `S3 Bucket "${name}": Owner Tenant "${bucket.tenantName}" does not exist in the tenant list.`,
            why: "Every S3 bucket must be owned by an active tenant account to manage security access policies and billing quotas.",
            fix: "Select an existing tenant from the dropdown selection on Step 4."
          });
        }

        // Retention days check
        if (bucket.objectLock && (!bucket.retentionDays || bucket.retentionDays < 1)) {
          errors.push({
            step: 4,
            title: "Invalid Object Lock Retention",
            msg: `S3 Bucket "${name}": Object Lock is active but Retention Days must be a positive number.`,
            why: "WORM compliance requires a lock duration. You cannot enable Object Lock without specifying a positive retention period.",
            fix: "Enter a positive number (minimum 1 day) for retention on Step 4."
          });
        }
      }
    });

    // 3. Grid HA IP check
    const haVip = state.sgIntegrations.haVip || "";
    if (haVip.trim() && !ipPattern.test(haVip.trim())) {
      errors.push({
        step: 2,
        title: "Invalid HA Virtual IP",
        msg: `StorageGRID HA Group: Virtual IP "${haVip}" has an invalid format.`,
        why: "High Availability group VIPs must be valid IPv4 addresses to configure virtual routing and bind client S3 connections.",
        fix: "Enter a valid IPv4 address for the HA Group VIP on Step 2."
      });
    }

    // 4. Validate Node Count relative to selected ILM policy erasure coding levels
    const totalNodes = state.sizing.nodeCount;
    const ilm = state.sgIntegrations.ilmPolicy;
    if (ilm === "ec_2_1" && totalNodes < 3) {
      errors.push({
        step: 1,
        title: "Insufficient Nodes for Erasure Coding 2+1",
        msg: `Selected Erasure Coding 2+1 policy requires at least 3 storage nodes, but currently only ${totalNodes} node(s) configured.`,
        why: "Erasure Coding 2+1 splits data into 2 data fragments and 1 parity fragment. Standard design rules require each fragment to reside on a separate physical storage node.",
        fix: "Increase the StorageGRID Node Count to 3 or more on Step 1, or select a replication policy (e.g. 2-Copy Replication) on Step 2."
      });
    } else if (ilm === "ec_4_2" && totalNodes < 6) {
      errors.push({
        step: 1,
        title: "Insufficient Nodes for Erasure Coding 4+2",
        msg: `Selected Erasure Coding 4+2 policy requires at least 6 storage nodes, but currently only ${totalNodes} node(s) configured.`,
        why: "Erasure Coding 4+2 splits data into 4 data fragments and 2 parity fragments. Standard design rules require each fragment to reside on a separate physical storage node.",
        fix: "Increase the StorageGRID Node Count to 6 or more on Step 1, or select a different ILM rule on Step 2."
      });
    } else if (ilm === "ec_6_3" && totalNodes < 9) {
      errors.push({
        step: 1,
        title: "Insufficient Nodes for Erasure Coding 6+3",
        msg: `Selected Erasure Coding 6+3 policy requires at least 9 storage nodes, but currently only ${totalNodes} node(s) configured.`,
        why: "Erasure Coding 6+3 splits data into 6 data fragments and 3 parity fragments. Standard design rules require each fragment to reside on a separate physical storage node.",
        fix: "Increase the StorageGRID Node Count to 9 or more on Step 1, or select a different ILM rule on Step 2."
      });
    }

    // 5. Check if total tenant physical required space exceeds designed grid usable capacity [NEW]
    if (state.sizing.usableGb > 0) {
      let totalTenantPhysicalGb = 0;
      state.sgTenants.forEach(t => {
        const phys = calculateTenantPhysicalGb(t.quota || 0, t.sites || 1, t.ilmPolicy || "2_copies");
        totalTenantPhysicalGb += phys;
      });
      if (totalTenantPhysicalGb > state.sizing.usableGb) {
        errors.push({
          step: 3,
          title: "StorageGRID Capacity Limit Exceeded",
          msg: `Total required physical storage for all tenants (${formatCapacity(totalTenantPhysicalGb)}) exceeds the designed grid usable capacity (${formatCapacity(state.sizing.usableGb)}).`,
          why: "The collective physical capacity required by your tenants (factoring in replication copies and erasure coding overhead across all sites) exceeds the physical capacity available in your node sizing design.",
          fix: "Increase the number of StorageGRID nodes or drive sizes in Step 1, or adjust tenant quotas, sites, and ILM rules in Step 3."
        });
      }
    }
  }

  // FabricPool Specific validation (for ONTAP platform if FabricPool is enabled)
  if (state.platform === "ontap" && state.ontapFabricPool.enabled) {
    const fp = state.ontapFabricPool;
    if (!fp.endpoint.trim()) {
      errors.push({
        step: 5,
        title: "Missing FabricPool Endpoint",
        msg: "FabricPool: StorageGRID Endpoint address is required.",
        why: "ONTAP requires the FQDN or IP of the object store to resolve routes and connect to the external capacity tier.",
        fix: "Enter the FQDN or IP of your StorageGRID S3 gateway on Step 5."
      });
    }
    if (!fp.accessKey.trim() || !fp.secretKey.trim()) {
      errors.push({
        step: 5,
        title: "Missing FabricPool Credentials",
        msg: "FabricPool: S3 Access/Secret Credentials are required.",
        why: "ONTAP authenticates to StorageGRID using S3 HMAC keys. Without credentials, aggregate attachments will be rejected.",
        fix: "Input the S3 Access Key and Secret Key for the FabricPool tenant account on Step 5."
      });
    }
    
    // Bucket name validation
    const bucket = fp.bucket.trim();
    if (!bucket) {
      errors.push({
        step: 5,
        title: "Missing FabricPool S3 Bucket",
        msg: "FabricPool: S3 Bucket Name is required.",
        why: "ONTAP needs to know which bucket it will use to write tiered cold blocks.",
        fix: "Enter the name of the target S3 bucket for FabricPool on Step 5."
      });
    } else {
      if (/[A-Z]/.test(bucket)) {
        warnings.push({
          step: 5,
          title: "Non-Compliant FabricPool Bucket Name",
          msg: `FabricPool S3 Bucket "${bucket}": Bucket Name contains uppercase characters. DNS compliance recommends lowercase only.`,
          why: "ONTAP S3 client uses DNS compliant routing. Uppercase bucket names may lead to SSL hostname mismatch warnings.",
          fix: "Rename the target S3 bucket to lowercase."
        });
      }
      if (/[^a-z0-9.-]/.test(bucket)) {
        errors.push({
          step: 5,
          title: "Invalid FabricPool Bucket Name Characters",
          msg: `FabricPool S3 Bucket "${bucket}": Bucket Name contains invalid characters. Use lowercase, numbers, hyphens, and periods only.`,
          why: "Bucket names must comply with RFC DNS syntax to prevent URL routing failures during block transfers.",
          fix: "Remove special characters from the FabricPool S3 bucket name."
        });
      }
    }

    if (fp.sslEnabled === false) {
      warnings.push({
        step: 5,
        title: "Insecure Tiering Connection",
        msg: "FabricPool: SSL Certificate Verification is disabled. This is not recommended for production environments.",
        why: "Disabling SSL certificate verification exposes tiered corporate data blocks to man-in-the-middle (MITM) snooping on the network.",
        fix: "Enable SSL check and upload trusted CA grid certificates to ONTAP."
      });
    }
  }

  // Version Check limits
  if (state.platform === "ontap") {
    const ontapVersionNum = versionToNum(state.version);
    const activeProtos = state.protocols || [state.protocol];
    
    if (activeProtos.includes("ontap_s3") && ontapVersionNum < 908) {
      errors.push({
        step: 4,
        title: "Unsupported ONTAP S3 Version",
        msg: `ONTAP Native S3 requires ONTAP 9.8.0 or higher. Current version: ${state.version}`,
        why: "Native object storage server capabilities were introduced in ONTAP 9.8. Earlier releases cannot host S3 endpoints.",
        fix: "Select ONTAP 9.8.0 or higher on Step 1, or change access protocol."
      });
    }
    if (activeProtos.includes("nvme_tcp") && ontapVersionNum < 910) {
      errors.push({
        step: 4,
        title: "Unsupported NVMe/TCP Version",
        msg: `NVMe/TCP requires ONTAP 9.10.1 or higher. Current version: ${state.version}`,
        why: "Standard NVMe over TCP protocol transport was stabilized and integrated into ONTAP in version 9.10.1.",
        fix: "Select ONTAP 9.10.1 or higher on Step 1, or change protocol."
      });
    }
  }

  // Protocols access validation
  if (state.platform === "ontap") {
    const activeProtos = state.protocols || [state.protocol];
    
    if (activeProtos.includes("nfs")) {
      if (!state.protocolData.nfs.exportPolicy.trim()) {
        errors.push({
          step: 4,
          title: "Missing NFS Export Policy",
          msg: "NFS Export Policy is required.",
          why: "NFS exports restrict mount permissions to specific IP addresses. An empty export policy will block all host mounts.",
          fix: "Specify an export policy name (e.g. default) on Step 4."
        });
      }
    } 
    if (activeProtos.includes("smb")) {
      if (!state.protocolData.smb.shareName.trim()) {
        errors.push({
          step: 4,
          title: "Missing SMB Share Name",
          msg: "SMB Share Name is required.",
          why: "SMB clients mount shares using active SMB share paths. Without a name, no share path is generated.",
          fix: "Enter an SMB share name on Step 4."
        });
      }
      if (!state.protocolData.smb.adDomain.trim()) {
        errors.push({
          step: 4,
          title: "Missing Active Directory Domain",
          msg: "Active Directory Domain is required.",
          why: "ONTAP SMB servers require Active Directory domains to join the domain controllers and resolve user ACLs.",
          fix: "Enter the FQDN of the AD domain on Step 4."
        });
      }
    }
    if (activeProtos.includes("iscsi")) {
      const iscsi = state.protocolData.iscsi;
      if (!iscsi.initiatorIqn.trim()) {
        errors.push({
          step: 4,
          title: "Missing Host iSCSI IQN",
          msg: "iSCSI Host Initiator IQN is required.",
          why: "ONTAP maps LUNs using initiator IQNs. Without host IQNs, LUN target masking cannot secure block permissions.",
          fix: "Provide the client host iSCSI Qualified Name (IQN) on Step 4."
        });
      }
    }
    if (activeProtos.includes("fc") || activeProtos.includes("fcoe")) {
      const fc = activeProtos.includes("fc") ? state.protocolData.fc : state.protocolData.fcoe;
      if (!fc.initiatorWwpn.trim()) {
        errors.push({
          step: 4,
          title: "Missing Host WWPN Ports",
          msg: "Host WWPN ports list is required.",
          why: "Fibre Channel fabric target mapping depends on World Wide Port Names (WWPN) to complete node-to-node zoning.",
          fix: "Specify the 16-hex WWPN initiator addresses (comma-separated) on Step 4."
        });
      }
    }
  }

  // Workload Host Validations
  const hv = state.workload.hypervisor;
  if (hv !== "none") {
    const hvHosts = state.workload[hv].hosts;
    if (!hvHosts || !hvHosts.trim()) {
      errors.push({
        step: 5,
        title: "Missing Hypervisor Host IP",
        msg: `Hypervisor "${hv.toUpperCase()}" active: Host targets/IPs field is required.`,
        why: "To configure multipathing profiles and target mount parameters, the configurator needs the target hypervisor host IPs.",
        fix: "Enter the IPs or hostnames of your hypervisor cluster nodes on Step 5."
      });
    }
  }

  // Management Network validation
  if (!state.network.mgmtIp.trim()) {
    errors.push({
      step: 6,
      title: "Missing Switch Management IP",
      msg: "Switch management IP is required.",
      why: "Switch zoning scripts require target IP variables to establish SSH CLI configuration sessions.",
      fix: "Enter a switch management IP address on Step 6."
    });
  } else if (!ipPattern.test(state.network.mgmtIp)) {
    errors.push({
      step: 6,
      title: "Invalid Switch Management IP Format",
      msg: "Switch management IP has an invalid format.",
      why: "The switch management IP address must be a valid IPv4 string to route configuration packets.",
      fix: "Correct the IP address format on Step 6."
    });
  }

  renderValidationTabUI(errors, warnings);

  // Review status
  const reviewValidationStatusBox = document.getElementById("reviewValidationStatusBox");
  const reviewValidationBadge = document.getElementById("reviewValidationBadge");
  const reviewValidationDetails = document.getElementById("reviewValidationDetails");
  const btnDownloadBundle = document.getElementById("btnDownloadBundle");

  if (errors.length > 0) {
    reviewValidationStatusBox.style.background = "rgba(239, 68, 68, 0.05)";
    reviewValidationStatusBox.style.borderColor = "rgba(239, 68, 68, 0.25)";
    reviewValidationBadge.className = "parser-badge error";
    reviewValidationBadge.innerHTML = `<i data-lucide="x-circle" style="width:14px;height:14px;"></i> ${errors.length} Error(s) Found`;
    btnDownloadBundle.disabled = true;
  } else if (warnings.length > 0) {
    reviewValidationStatusBox.style.background = "rgba(245, 158, 11, 0.05)";
    reviewValidationStatusBox.style.borderColor = "rgba(245, 158, 11, 0.25)";
    reviewValidationBadge.className = "parser-badge error";
    reviewValidationBadge.style.background = "rgba(245, 158, 11, 0.15)";
    reviewValidationBadge.style.color = "rgb(245, 158, 11)";
    reviewValidationBadge.innerHTML = `<i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> ${warnings.length} Warning(s) Found`;
    btnDownloadBundle.disabled = false;
  } else {
    reviewValidationStatusBox.style.background = "rgba(16, 185, 129, 0.05)";
    reviewValidationStatusBox.style.borderColor = "rgba(16, 185, 129, 0.25)";
    reviewValidationBadge.className = "parser-badge success";
    reviewValidationBadge.style.background = "";
    reviewValidationBadge.style.color = "";
    reviewValidationBadge.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px;"></i> Configuration Validated`;
    btnDownloadBundle.disabled = false;
  }

  // Populate details on Step 8 Review page
  if (reviewValidationDetails) {
    if (errors.length > 0 || warnings.length > 0) {
      reviewValidationDetails.style.display = "flex";
      reviewValidationDetails.innerHTML = "";

      errors.forEach(err => {
        const item = document.createElement("div");
        item.style.padding = "10px 12px";
        item.style.borderRadius = "4px";
        item.style.background = "rgba(239, 68, 68, 0.08)";
        item.style.border = "1px solid rgba(239, 68, 68, 0.2)";
        item.style.fontSize = "0.8rem";
        item.style.color = "#fff";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.gap = "4px";

        let html = `
          <div style="display: flex; align-items: flex-start; gap: 8px; font-weight: 600; color: #ff8a8a;">
            <i data-lucide="x-circle" style="width:14px;height:14px;margin-top:2px;"></i>
            <span>${err.title || 'Step ' + err.step + ' Input Error'}</span>
          </div>
          <div style="margin-left: 22px; color: rgba(255,255,255,0.9); line-height: 1.4;">${err.msg}</div>
        `;
        if (err.why) {
          html += `<div style="margin-left: 22px; font-size: 0.72rem; color: var(--text-muted);"><strong>Impact:</strong> ${err.why}</div>`;
        }
        if (err.fix) {
          html += `<div style="margin-left: 22px; font-size: 0.72rem; color: var(--color-accent-cyan);"><strong>Resolution:</strong> ${err.fix}</div>`;
        }
        item.innerHTML = html;
        reviewValidationDetails.appendChild(item);
      });

      warnings.forEach(warn => {
        const item = document.createElement("div");
        item.style.padding = "10px 12px";
        item.style.borderRadius = "4px";
        item.style.background = "rgba(245, 158, 11, 0.08)";
        item.style.border = "1px solid rgba(245, 158, 11, 0.2)";
        item.style.fontSize = "0.8rem";
        item.style.color = "#fff";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.gap = "4px";

        let html = `
          <div style="display: flex; align-items: flex-start; gap: 8px; font-weight: 600; color: #ffb03a;">
            <i data-lucide="alert-triangle" style="width:14px;height:14px;margin-top:2px;"></i>
            <span>${warn.title || 'Step ' + warn.step + ' Warning'}</span>
          </div>
          <div style="margin-left: 22px; color: rgba(255,255,255,0.9); line-height: 1.4;">${warn.msg}</div>
        `;
        if (warn.why) {
          html += `<div style="margin-left: 22px; font-size: 0.72rem; color: var(--text-muted);"><strong>Impact:</strong> ${warn.why}</div>`;
        }
        if (warn.fix) {
          html += `<div style="margin-left: 22px; font-size: 0.72rem; color: var(--color-accent-cyan);"><strong>Resolution:</strong> ${warn.fix}</div>`;
        }
        item.innerHTML = html;
        reviewValidationDetails.appendChild(item);
      });
    } else {
      reviewValidationDetails.style.display = "none";
      reviewValidationDetails.innerHTML = "";
    }
  }

  safeCreateIcons();

  return { errors, warnings };
}

function renderValidationTabUI(errors, warnings) {
  const totalErrors = errors.length;
  const totalPassed = 5 - totalErrors > 0 ? 5 - totalErrors : 0;

  document.getElementById("statValidCount").innerText = totalPassed;
  document.getElementById("statErrorCount").innerText = totalErrors;
  
  const invalidPill = document.getElementById("statInvalidPill");
  if (totalErrors > 0) {
    invalidPill.style.background = "rgba(239, 68, 68, 0.15)";
    invalidPill.style.color = "var(--color-error)";
  } else {
    invalidPill.style.background = "rgba(255, 255, 255, 0.03)";
    invalidPill.style.color = "var(--text-muted)";
  }

  const listEl = document.getElementById("validationItemsList");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (errors.length === 0 && warnings.length === 0) {
    const item = document.createElement("div");
    item.className = "validation-item success";
    item.innerHTML = `<i data-lucide="check" class="validation-icon" style="width:14px;height:14px;"></i>
                      <div><strong>Step Inputs Verified</strong><p style="font-size: 0.72rem; margin-top:2px;">All storage configuration parameters align with engineering best practices.</p></div>`;
    listEl.appendChild(item);
  }

  errors.forEach(err => {
    const item = document.createElement("div");
    item.className = "validation-item error";
    item.style.display = "flex";
    item.style.flexDirection = "column";
    item.style.gap = "6px";
    item.style.padding = "12px";
    item.style.border = "1px solid rgba(239, 68, 68, 0.25)";
    item.style.background = "rgba(239, 68, 68, 0.05)";
    
    let html = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <i data-lucide="x" style="width:14px;height:14px;color:var(--color-error);margin-top:2px;"></i>
        <div>
          <strong style="color:#fff; font-size:0.8rem;">${err.title || 'Step ' + err.step + ' Input Error'}</strong>
          <p style="font-size: 0.72rem; margin-top:2px; color:rgba(255,255,255,0.75);">${err.msg}</p>
        </div>
      </div>
    `;
    if (err.why) {
      html += `<div style="font-size: 0.68rem; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; margin-left: 22px;"><strong>Architectural Impact:</strong> ${err.why}</div>`;
    }
    if (err.fix) {
      html += `<div style="font-size: 0.68rem; color: var(--color-accent-cyan); margin-left: 22px;"><strong>Resolution Guide:</strong> ${err.fix}</div>`;
    }
    
    item.innerHTML = html;
    listEl.appendChild(item);
  });

  warnings.forEach(warn => {
    const item = document.createElement("div");
    item.className = "validation-item error";
    item.style.borderColor = "rgba(245, 158, 11, 0.25)";
    item.style.background = "rgba(245, 158, 11, 0.05)";
    item.style.display = "flex";
    item.style.flexDirection = "column";
    item.style.gap = "6px";
    item.style.padding = "12px";
    
    let html = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <i data-lucide="alert-triangle" style="width:14px;height:14px;color:var(--color-warning);margin-top:2px;"></i>
        <div>
          <strong style="color:#ffb74d; font-size:0.8rem;">${warn.title || 'Step ' + warn.step + ' Design Info'}</strong>
          <p style="font-size: 0.72rem; margin-top:2px; color:rgba(255,255,255,0.75);">${warn.msg}</p>
        </div>
      </div>
    `;
    if (warn.why) {
      html += `<div style="font-size: 0.68rem; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; margin-left: 22px;"><strong>Best-Practice Detail:</strong> ${warn.why}</div>`;
    }
    if (warn.fix) {
      html += `<div style="font-size: 0.68rem; color: var(--color-accent-cyan); margin-left: 22px;"><strong>Optimization Recommendation:</strong> ${warn.fix}</div>`;
    }
    
    item.innerHTML = html;
    listEl.appendChild(item);
  });

  safeCreateIcons();
}

function vserverSanitize(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, "");
}

function syncUIWithState() {
  document.getElementById("modeGreenfield").classList.toggle("selected", state.mode === "greenfield");
  document.getElementById("modeExisting").classList.toggle("selected", state.mode === "existing");
  document.getElementById("platformOntap").classList.toggle("selected", state.platform === "ontap");
  document.getElementById("platformStoragegrid").classList.toggle("selected", state.platform === "storagegrid");
  
  // Sync software version dropdown
  const versionSelect = document.getElementById("platformVersion");
  if (versionSelect && state.version) {
    let hasOpt = false;
    for (let i = 0; i < versionSelect.options.length; i++) {
      if (versionSelect.options[i].value === state.version) {
        hasOpt = true;
        break;
      }
    }
    if (!hasOpt) {
      const opt = document.createElement("option");
      opt.value = state.version;
      opt.innerText = state.version;
      versionSelect.prepend(opt);
    }
    versionSelect.value = state.version;
  }
  
  // ONTAP platform profile synchronization
  const ontapPlatformSelect = document.getElementById("ontapPlatform");
  if (ontapPlatformSelect && state.ontapPlatform) {
    ontapPlatformSelect.value = state.ontapPlatform;
  }
  const ontapPlatformGroup = document.getElementById("ontapPlatformGroup");
  if (ontapPlatformGroup) {
    ontapPlatformGroup.style.display = state.platform === "ontap" ? "block" : "none";
  }

  const metroclusterToggleGroup = document.getElementById("metroclusterToggleGroup");
  if (metroclusterToggleGroup) {
    metroclusterToggleGroup.style.display = state.platform === "ontap" ? "block" : "none";
  }
  const metroclusterConfigGroup = document.getElementById("metroclusterConfigGroup");
  if (metroclusterConfigGroup) {
    metroclusterConfigGroup.style.display = (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) ? "block" : "none";
  }
  const metroclusterCheckbox = document.getElementById("metroclusterEnabled");
  if (metroclusterCheckbox) {
    metroclusterCheckbox.checked = !!(state.metrocluster && state.metrocluster.enabled);
  }
  if (state.metrocluster) {
    ["Type", "Scale", "Distance", "Latency", "Mediator"].forEach(key => {
      const el = document.getElementById(`metrocluster${key}`);
      if (el) el.value = state.metrocluster[key.toLowerCase()] || "";
    });
  }

  const ontapWorkloads = document.getElementById("ontapWorkloadsContainer");
  const sgWorkloads = document.getElementById("sgWorkloadsContainer");
  if (ontapWorkloads) ontapWorkloads.style.display = state.platform === "ontap" ? "block" : "none";
  if (sgWorkloads) sgWorkloads.style.display = state.platform === "storagegrid" ? "block" : "none";

  const isSg = state.platform === "storagegrid";
  const navStep5 = document.getElementById("navStep5");
  const navStep6 = document.getElementById("navStep6");
  const navStep7 = document.getElementById("navStep7");
  if (navStep5) navStep5.style.display = isSg ? "none" : "";
  if (navStep6) navStep6.style.display = isSg ? "none" : "";
  if (navStep7) navStep7.style.display = isSg ? "none" : "";

  let badgeNum = 1;
  document.querySelectorAll(".nav-steps .nav-step").forEach(stepEl => {
    if (stepEl.style.display !== "none") {
      const badge = stepEl.querySelector(".step-number-badge");
      if (badge) badge.innerText = badgeNum++;
    }
  });

  // Sync StorageGRID integrations values
  if (state.sgIntegrations) {
    document.getElementById("sgIdentityFederation").value = state.sgIntegrations.identityFederation;
    document.getElementById("sgKmsProvider").value = state.sgIntegrations.kmsProvider;
    document.getElementById("sgIlmPolicy").value = state.sgIntegrations.ilmPolicy;
    document.getElementById("sgEventNotifications").checked = state.sgIntegrations.eventNotifications;
    document.getElementById("sgCloudMirror").checked = state.sgIntegrations.cloudMirror;
    document.getElementById("sgSearchIntegration").checked = state.sgIntegrations.searchIntegration;
    document.getElementById("sgTlsCompliance").value = state.sgIntegrations.tlsCompliance;
    
    // Sync StorageGRID 12.0+ checkboxes
    const isSg12 = (state.platform === "storagegrid" && state.version === "12.0");
    const cachingInput = document.getElementById("sgS3Caching");
    const cachingCard = document.getElementById("sgS3CachingCard");
    const assumeRoleInput = document.getElementById("sgAssumeRole");
    const assumeRoleCard = document.getElementById("sgAssumeRoleCard");
    const sg12Features = document.getElementById("sg12FeaturesGroup");

    if (sg12Features) {
      sg12Features.style.display = (state.platform === "storagegrid") ? "block" : "none";
    }

    if (cachingInput && cachingCard) {
      cachingInput.disabled = !isSg12;
      if (!isSg12) {
        state.sgIntegrations.s3Caching = false;
      }
      cachingInput.checked = !!state.sgIntegrations.s3Caching;
      cachingCard.style.opacity = isSg12 ? "1" : "0.3";
      cachingCard.style.pointerEvents = isSg12 ? "auto" : "none";
    }

    if (assumeRoleInput && assumeRoleCard) {
      assumeRoleInput.disabled = !isSg12;
      if (!isSg12) {
        state.sgIntegrations.assumeRole = false;
      }
      assumeRoleInput.checked = !!state.sgIntegrations.assumeRole;
      assumeRoleCard.style.opacity = isSg12 ? "1" : "0.3";
      assumeRoleCard.style.pointerEvents = isSg12 ? "auto" : "none";
    }
  }

  // Render tables
  if (state.platform === "storagegrid") {
    renderSgTenantTable();
    renderSgBucketTable();
  } else {
    renderSvmTable();
    renderVolumeTable();
  }

  // FabricPool target fields
  const fpEnabledCheck = document.getElementById("ontapFabricPoolEnabled");
  if (fpEnabledCheck) {
    fpEnabledCheck.checked = state.ontapFabricPool.enabled;
    document.getElementById("fpSgEndpoint").value = state.ontapFabricPool.endpoint;
    document.getElementById("fpSgPort").value = state.ontapFabricPool.port;
    document.getElementById("fpSgAccessKey").value = state.ontapFabricPool.accessKey;
    document.getElementById("fpSgSecretKey").value = state.ontapFabricPool.secretKey;
    document.getElementById("fpSgBucket").value = state.ontapFabricPool.bucket;
    document.getElementById("fpSgSsl").value = state.ontapFabricPool.sslEnabled ? "true" : "false";
    document.getElementById("fpProvider").value = state.ontapFabricPool.providerType || "SG";
    document.getElementById("fpCaCertName").value = state.ontapFabricPool.caCertName || "FabricPool_CA";
    document.getElementById("fpCaCertPem").value = state.ontapFabricPool.caCertPem || "";
    document.getElementById("fpCaCertPemGroup").style.display = state.ontapFabricPool.sslEnabled ? "block" : "none";
    document.getElementById("ontapFabricPoolFields").style.display = state.ontapFabricPool.enabled ? "block" : "none";
  }

  // StorageGRID HA and LB extensions
  const haGroupNameEl = document.getElementById("sgHaGroupName");
  if (haGroupNameEl) {
    haGroupNameEl.value = state.sgIntegrations.haGroupName || "";
    document.getElementById("sgHaVip").value = state.sgIntegrations.haVip || "";
    document.getElementById("sgHaMembers").value = state.sgIntegrations.haMembers || "";
    document.getElementById("sgLbPort").value = state.sgIntegrations.lbPort || 10443;
    document.getElementById("sgLbEndpointName").value = state.sgIntegrations.lbEndpointName || "";
    document.getElementById("sgLbProtocol").value = state.sgIntegrations.lbProtocol || "https";
  }

  // Protocol select grid and visibility
  updateProtocolFormsVisibility();

  // Switch values
  updateSwitchVersionOptions();
  document.getElementById("switchVersion").value = state.network.switchVersion;
  document.getElementById("switchPortSpeed").value = state.network.portSpeed;
  document.getElementById("switchMtu").value = state.network.mtu;
  document.getElementById("switchVlanId").value = state.network.vlanId;
  document.getElementById("switchMgmtIp").value = state.network.mgmtIp;
  document.getElementById("switchZoningEnable").checked = state.network.zoningEnable;
  
  if (document.getElementById("customSwitchAName")) {
    document.getElementById("customSwitchAName").value = state.customSwitchNames.switchA || "Switch-A";
    document.getElementById("customSwitchBName").value = state.customSwitchNames.switchB || "Switch-B";
  }
  renderNodeNameInputs();

  document.querySelectorAll("#stepPanel7 .options-grid .option-card").forEach(card => {
    card.classList.toggle("selected", card.getAttribute("data-switch") === state.network.switchBrand);
  });
  const zoningGroup = document.getElementById("fabricSwitchGroup");
  if (zoningGroup) {
    zoningGroup.style.display = (state.network.switchBrand === "cisco" || state.network.switchBrand === "brocade") ? "block" : "none";
  }

  // Trident values
  document.getElementById("tridentIntegration").checked = state.trident.enabled;
  document.getElementById("tridentFieldsContainer").style.display = state.trident.enabled ? "block" : "none";
  document.getElementById("tridentK8sVersion").value = state.trident.k8sVersion;
  document.getElementById("tridentDriverVersion").value = state.trident.driverVersion;
  document.getElementById("tridentScReclaimPolicy").value = state.trident.reclaimPolicy;
  document.getElementById("tridentScFsType").value = state.trident.fsType;
  document.getElementById("tridentBackendName").value = state.trident.backendName;

  // Workload profile selects
  document.getElementById("workloadHypervisor").value = state.workload.hypervisor;
  document.getElementById("workloadDb").value = state.workload.db;

  // Sync workload card visibilities [NEW]
  const hv = state.workload.hypervisor || "none";
  const hvCard = document.getElementById("hypervisorSettingsCard");
  const esxiFields = document.getElementById("hypervisorFields_esxi");
  const hypervFields = document.getElementById("hypervisorFields_hyperv");
  const kvmFields = document.getElementById("hypervisorFields_kvm");
  if (hvCard && esxiFields && hypervFields && kvmFields) {
    if (hv === "none") {
      hvCard.style.display = "none";
    } else {
      hvCard.style.display = "block";
      esxiFields.style.display = hv === "esxi" ? "block" : "none";
      hypervFields.style.display = hv === "hyperv" ? "block" : "none";
      kvmFields.style.display = hv === "kvm" ? "block" : "none";
    }
  }

  const db = state.workload.db || "none";
  const dbAutoLayoutGroup = document.getElementById("dbAutoLayoutGroup");
  const dbCard = document.getElementById("dbSettingsCard");
  const oracleFields = document.getElementById("dbFields_oracle");
  const mssqlFields = document.getElementById("dbFields_mssql");
  const postgresFields = document.getElementById("dbFields_postgres");
  if (dbAutoLayoutGroup && dbCard && oracleFields && mssqlFields && postgresFields) {
    if (db === "none") {
      dbAutoLayoutGroup.style.display = "none";
      dbCard.style.display = "none";
    } else {
      dbAutoLayoutGroup.style.display = "block";
      dbCard.style.display = "block";
      oracleFields.style.display = db === "oracle" ? "block" : "none";
      mssqlFields.style.display = db === "mssql" ? "block" : "none";
      postgresFields.style.display = db === "postgres" ? "block" : "none";
    }
  }

  // Sync SVM & Volume lists containers [NEW]
  document.getElementById("svmListOntapContainer").style.display = state.platform === "ontap" ? "block" : "none";
  document.getElementById("svmListSgContainer").style.display = state.platform === "storagegrid" ? "block" : "none";
  document.getElementById("volumeListOntapContainer").style.display = state.platform === "ontap" ? "block" : "none";
  document.getElementById("volumeListSgContainer").style.display = state.platform === "storagegrid" ? "block" : "none";

  // Sync Sizing inputs [NEW]
  const sizingGroup = document.getElementById("greenfieldSizingGroup");
  if (sizingGroup) {
    sizingGroup.style.display = "block";
  }

  updateSizingDropdownOptions();
  updateDiskSizeOptions();


  document.getElementById("sizingController").value = state.sizing.controller;
  document.getElementById("sizingNodeCount").value = state.sizing.nodeCount;
  document.getElementById("sizingShelfType").value = state.sizing.shelfType;
  document.getElementById("sizingDiskCount").value = state.sizing.diskCount;
  
  if (state.platform === "ontap") {
    document.getElementById("sizingRaidType").value = state.sizing.raidType;
    document.getElementById("sizingRaidGroupSize").value = state.sizing.raidGroupSize;
    document.getElementById("sizingSpareDisks").value = state.sizing.spareDisks;
    document.getElementById("sizingAggrName").value = state.sizing.aggrNamePrefix;
  }

  document.getElementById("sizingDiskSize").value = state.sizing.diskSize;

  // Sync cabling cards
  const switchedCard = document.getElementById("cablingSwitched");
  const directCard = document.getElementById("cablingDirect");
  if (switchedCard && directCard) {
    switchedCard.classList.toggle("selected", state.sizing.clusterCabling === "switched");
    directCard.classList.toggle("selected", state.sizing.clusterCabling === "direct");
    document.getElementById("clusterSwitchModelGroup").style.display = state.sizing.clusterCabling === "switched" ? "block" : "none";
    document.getElementById("clusterSwitchModel").value = state.sizing.clusterSwitchModel;
  }

  // Sync QoS inputs [NEW]
  const qosPolicyTypeSelect = document.getElementById("qosPolicyType");
  if (qosPolicyTypeSelect) {
    qosPolicyTypeSelect.value = state.qos.policyType;
    document.getElementById("qosExpectedIops").value = state.qos.expectedIops;
    document.getElementById("qosPeakIops").value = state.qos.peakIops;
    document.getElementById("qosPeakThroughput").value = state.qos.peakThroughput;
    document.getElementById("qosAllocatedIops").value = state.qos.allocatedIops;
    document.getElementById("qosPeakIopsPerTb").value = state.qos.peakIopsPerTb;
    document.getElementById("qosAbsoluteMinIops").value = state.qos.absoluteMinIops;
    updateQosFieldsVisibility(state.qos.policyType);
  }

  // Run sizing & cabling planners [NEW]
  recalculateCapacity();
  updateCablingPlanner();

  updateSummaryPanel();
}

// 13. JSZIP ARCHIVE BUILDER WITH DOCUMENTATION
function downloadConfigurationBundle() {
  try {
    const { errors } = validateForm();
    if (errors.length > 0) {
      alert("Please fix all form validation errors in the configurator before generating your configuration ZIP bundle.");
      return;
    }

    const zip = safeNewJSZip();
    if (!zip) {
      alert("JSZip library is not available. Please verify your network connection or CDN access.");
      return;
    }

    const cliFilename = state.platform === "storagegrid" ? "storagegrid_cli_config.txt" : "ontap_cli_config.txt";
    const cliContent = state.platform === "storagegrid" ? generateStoragegridCliCode() : generateOntapCliCode();
    
    const ansibleFilename = "ansible_playbook.yaml";
    const ansibleContent = generateAnsiblePlaybook();

    const switchFilename = "switch_config.txt";
    const switchContent = generateSwitchConfig();

    const tridentFilename = "trident_config.yaml";
    const tridentContent = generateTridentConfig();

    const docFilename = "deployment_guide.md";
    const docContent = generateDeploymentGuide();

    const summaryFilename = "summary.json";
    const summaryContent = JSON.stringify(state, null, 2);

    zip.file(cliFilename, cliContent);
    zip.file(ansibleFilename, ansibleContent);
    zip.file(switchFilename, switchContent);
    if (state.platform === "ontap") {
      zip.file(tridentFilename, tridentContent);
      if (state.mode === "greenfield") {
        const cablingEl = document.getElementById("cablingAsciiDiagram");
        const cablingContent = cablingEl ? cablingEl.textContent : "";
        zip.file("cabling_topology.txt", cablingContent);
      }
    }
    zip.file("topology_diagram.svg", generateSvgTopology());
    if (state.platform === "ontap") {
      zip.file("cabling_diagram.svg", generateSvgPhysicalCabling());
    }
    zip.file("presales_proposal.md", generatePresalesProposalMarkdown());
    zip.file("hld_lld_design.md", generateHldLldDesign());
    zip.file("bill_of_materials.md", generateBillOfMaterials());
    zip.file("sizing_capacity_report.md", generateSizingReport());
    zip.file("performance_metrics.md", generatePerformanceReport());
    zip.file("configuration_guidelines.md", generateConfigurationGuidelines());
    zip.file(state.platform === "storagegrid" ? "storagegrid_bucket_details.md" : "volume_lun_details.md", generateVolumeLunConfig());
    zip.file(docFilename, docContent);
    zip.file(summaryFilename, summaryContent);
    zip.file("netapp_config.json", summaryContent);

    zip.generateAsync({ type: "blob" }).then((content) => {
      safeTriggerDownload(`netapp-deployment-bundle.zip`, content);
    }).catch((err) => {
      console.error("Failed to generate ZIP archive:", err);
      alert("An error occurred while compiling the download bundle: " + err.message);
    });
  } catch (err) {
    console.error("Synchronous error during zip compilation:", err);
    alert("A synchronous error occurred while compiling the download bundle: " + err.message + "\n\nStack trace:\n" + err.stack);
  }
}

// 14. INDIVIDUAL FILE EXPORTER
function downloadPreviewFile() {
  const activeTabEl = document.querySelector(".preview-tab.active");
  if (!activeTabEl) return;
  const currentTab = activeTabEl.id;

  let generatedText = "";
  let filename = "config.txt";

  if (currentTab === "tabCode") {
    if (state.platform === "storagegrid") {
      generatedText = generateStoragegridCliCode();
      filename = "storagegrid_cli_config.txt";
    } else {
      generatedText = generateOntapCliCode();
      filename = "ontap_cli_config.txt";
    }
  } 
  else if (currentTab === "tabSwitch") {
    generatedText = generateSwitchConfig();
    filename = "switch_config.txt";
  }
  else if (currentTab === "tabAnsible") {
    generatedText = generateAnsiblePlaybook();
    filename = "ansible_playbook.yaml";
  }
  else if (currentTab === "tabTrident") {
    generatedText = generateTridentConfig();
    filename = "trident_config.yaml";
  }
  else if (currentTab === "tabGuide") {
    generatedText = generateDeploymentGuide();
    filename = "deployment_guide.md";
  }
  else if (currentTab === "tabVariables") {
    generatedText = JSON.stringify(state, null, 2);
    filename = "summary.json";
  } 
  else if (currentTab === "tabValidation") {
    const items = validateForm();
    generatedText = `# Form Field Validations Logs\n# Errors: ${items.errors.length} | Warnings: ${items.warnings.length}\n\n`;
    if (items.errors.length === 0) {
      generatedText += `[✓] All required form fields validated successfully!\n`;
    } else {
      generatedText += `[✗] The following form errors need resolution before building:\n`;
      items.errors.forEach(e => generatedText += `- ERROR: ${e.msg}\n`);
    }
    if (items.warnings.length > 0) {
      generatedText += `\n[!] Warnings:\n`;
      items.warnings.forEach(w => generatedText += `- WARNING: ${w.msg}\n`);
    }
    filename = "validation_report.txt";
  }

  safeTriggerDownload(filename, generatedText);
}

// 14B. PRESALES PROPOSAL CALCULATORS AND GENERATORS
function calculatePerformanceMetrics() {
  const isSg = state.platform === "storagegrid";
  const nodes = parseInt(state.sizing.nodeCount) || 2;
  const diskCount = parseInt(state.sizing.diskCount) || 24;
  
  let totalDisks = 0;
  if (isSg) {
    totalDisks = nodes * diskCount;
  } else {
    totalDisks = (nodes / 2) * diskCount;
  }
  
  let iops = 0;
  let throughputMb = 0;
  let latencyMs = 0;
  
  if (isSg) {
    const model = state.sizing.controller || "SG5860";
    if (model.includes("6160")) { // All-Flash
      iops = nodes * 40000;
      throughputMb = nodes * 6000;
      latencyMs = 1.2;
    } else if (model.includes("6060") || model.includes("5860")) { // High density HDD + SSD Cache
      iops = nodes * 6000;
      throughputMb = nodes * 1800;
      latencyMs = 6.5;
    } else if (model.includes("5712") || model.includes("5812")) { // Direct HDD
      iops = nodes * 1500;
      throughputMb = nodes * 600;
      latencyMs = 12.0;
    } else if (model.includes("Virtual") || model.includes("Software")) {
      iops = nodes * 3000;
      throughputMb = nodes * 800;
      latencyMs = 5.0;
    } else { // SG100/SG1000/SG110/SG1100 compute nodes
      iops = nodes * 100000;
      throughputMb = nodes * 12000;
      latencyMs = 0.8;
    }
  } else {
    // ONTAP
    const profile = state.ontapPlatform || "aff";
    const controller = state.sizing.controller || "AFF_A250";
    
    let baseIopsPerDisk = 150; // SATA HDD default
    let baseThroughputPerDisk = 10; // MB/s
    let baseLatency = 8.0; // ms
    
    if (profile === "aff" || profile === "asa") {
      baseIopsPerDisk = 12000;
      baseThroughputPerDisk = 250;
      baseLatency = 0.5;
    } else if (controller.includes("C250") || controller.includes("C400") || controller.includes("C800")) {
      baseIopsPerDisk = 6000;
      baseThroughputPerDisk = 150;
      baseLatency = 1.2;
    } else if (profile === "afx") { // hybrid
      baseIopsPerDisk = 250;
      baseThroughputPerDisk = 25;
      baseLatency = 4.0;
    }
    
    iops = totalDisks * baseIopsPerDisk;
    throughputMb = totalDisks * baseThroughputPerDisk;
    latencyMs = baseLatency;
    
    // Cap IOPS and throughput by controller limits to be realistic
    let maxControllerIops = 500000;
    let maxControllerThroughput = 10000; // MB/s
    
    const cUpper = controller.toUpperCase();
    if (cUpper.includes("A1K") || cUpper.includes("A90") || cUpper.includes("C80") || cUpper.includes("ASA_A90") || cUpper.includes("ASA_C80") || cUpper.includes("A900") || cUpper.includes("C800") || cUpper.includes("ASA_A900") || cUpper.includes("ASA_C800")) {
      maxControllerIops = nodes * 1000000;
      maxControllerThroughput = nodes * 50000;
    } else if (cUpper.includes("A70") || cUpper.includes("A50") || cUpper.includes("C60") || cUpper.includes("ASA_A70") || cUpper.includes("ASA_A50") || cUpper.includes("ASA_C60") || cUpper.includes("A400") || cUpper.includes("C400") || cUpper.includes("ASA_A400") || cUpper.includes("ASA_C400") || cUpper.includes("FAS9500")) {
      maxControllerIops = nodes * 600000;
      maxControllerThroughput = nodes * 30000;
    } else if (cUpper.includes("A30") || cUpper.includes("A20") || cUpper.includes("C30") || cUpper.includes("ASA_A30") || cUpper.includes("ASA_A20") || cUpper.includes("ASA_C30") || cUpper.includes("A250") || cUpper.includes("A150") || cUpper.includes("C250") || cUpper.includes("FAS8700") || cUpper.includes("FAS8300") || cUpper.includes("FAS70")) {
      maxControllerIops = nodes * 250000;
      maxControllerThroughput = nodes * 12000;
    } else { // FAS2750, FAS2820, entry level
      maxControllerIops = nodes * 50000;
      maxControllerThroughput = nodes * 3000;
    }
    
    if (iops > maxControllerIops) iops = maxControllerIops;
    if (throughputMb > maxControllerThroughput) throughputMb = maxControllerThroughput;
  }
  
  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    // Synchronous write replication over inter-site fiber links introduces a latency penalty equal to network RTT
    latencyMs += state.metrocluster.latency;
  }
  
  return {
    iops: Math.round(iops),
    throughputMb: Math.round(throughputMb),
    latencyMs: parseFloat(latencyMs.toFixed(2))
  };
}

function generatePresalesProposalMarkdown() {
  const isSg = state.platform === "storagegrid";
  const perf = calculatePerformanceMetrics();
  
  let md = ``;
  md += `# TECHNICAL PRESALES PROPOSAL: NETAPP STORAGE SOLUTION\n`;
  md += `**Document Reference:** NetApp-Presales-${state.platform.toUpperCase()}-2026\n`;
  md += `**Generated Date:** ${new Date().toLocaleDateString()}\n`;
  md += `**Target System Configuration:** ${state.platform.toUpperCase()} Cluster\n`;
  md += `=========================================================================\n\n`;
  
  // 1. Solution Overview
  md += `## 1. Executive Summary & Solution Overview\n`;
  if (isSg) {
    md += `This proposal outlines a highly scalable, distributed object storage solution based on **NetApp StorageGRID v${state.version}**. The solution provides industry-standard S3 compliance with geo-distributed architecture, multi-site availability, and enterprise-grade lifecycle management (ILM). It provides high durability for unstructured object data, media repositories, and analytical archives.\n\n`;
  } else {
    md += `This proposal details an enterprise network storage solution based on **NetApp ONTAP v${state.version}**. The solution leverages advanced unified storage architecture supporting block (SAN) and file (NAS) protocols concurrently. Designed for high availability, transactional databases, virtualization platforms, and container orchestration workloads, it ensures maximum data reduction efficiencies and robust business continuity.\n\n`;
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      md += `This configuration incorporates **NetApp MetroCluster ${mcc.type.toUpperCase()}** to deliver synchronous zero-data-loss (RPO=0) disaster recovery across a distance of **${mcc.distance} km** with **${mcc.latency} ms RTT** latency. The configuration uses an active-active dual-site architecture supported by **${mcc.mediator === "mediator" ? "ONTAP Mediator" : (mcc.mediator === "tiebreaker" ? "Tiebreaker Node" : "manual DR controls")}** for automated failover (AUSO) protection.\n\n`;
    }
  }
  
  // 2. Hardware Architecture & LLD
  md += `## 2. Low-Level Design (LLD) & Configuration Inventory\n`;
  md += `### Hardware Configuration\n`;
  md += `| Parameter | Configured Specification |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Controller Model** | ${state.sizing.controller} |\n`;
  md += `| **Node Count** | ${state.sizing.nodeCount} node(s) |\n`;
  md += `| **Disk Drive Shelf** | ${state.sizing.shelfType} |\n`;
  md += `| **Drive Type & Size** | ${state.sizing.diskSize} |\n`;
  let disksLabel = "Disks per Node";
  let totalDrives = 0;
  if (isSg) {
    disksLabel = "Disks per Node";
    totalDrives = parseInt(state.sizing.nodeCount) * parseInt(state.sizing.diskCount);
  } else {
    disksLabel = "Disks per Node Pair";
    const nodePairs = parseInt(state.sizing.nodeCount) / 2;
    totalDrives = nodePairs * parseInt(state.sizing.diskCount);
    if (state.metrocluster && state.metrocluster.enabled) {
      totalDrives *= 2;
    }
  }

  md += `| **${disksLabel}** | ${state.sizing.diskCount} disk(s) |\n`;
  md += `| **Total Physical Disks** | ${totalDrives} |\n`;
  
  if (isSg) {
    md += `| **Active ILM Rule** | ${state.sgIntegrations.ilmPolicy.toUpperCase()} |\n`;
  } else {
    md += `| **RAID / Aggregate Group** | RAID-${state.sizing.raidType.toUpperCase()} (Group Size: ${state.sizing.raidGroupSize}) |\n`;
    md += `| **FabricPool Cloud Tier** | ${state.ontapFabricPool.enabled ? 'Enabled (' + state.ontapFabricPool.endpoint + ')' : 'Disabled'} |\n`;
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      md += `| **MetroCluster DR** | Enabled (${mcc.type.toUpperCase()} Fabric) |\n`;
      md += `| **Site-to-Site Distance** | ${mcc.distance} km |\n`;
      md += `| **Synchronous RTT Latency** | ${mcc.latency} ms |\n`;
      md += `| **DR Mediator** | ${mcc.mediator === "mediator" ? "ONTAP Mediator" : (mcc.mediator === "tiebreaker" ? "Tiebreaker Node" : "None")} |\n`;
    }
  }
  md += `\n`;
  
  // Logical resources table
  md += `### Logical Layout & Resource Allocations\n`;
  if (isSg) {
    md += `| S3 Tenant Account | Sites | ILM Protection Type | Quota (GB) | Est. Physical Footprint (GB) |\n`;
    md += `| :--- | :---: | :--- | :--- | :--- |\n`;
    state.sgTenants.forEach(tenant => {
      const quota = tenant.quota || "Unlimited";
      let ecLabel = "Replication";
      if (tenant.ilmPolicy && tenant.ilmPolicy.includes("ec")) ecLabel = "Erasure Coding";
      const phys = calculateTenantPhysicalGb(tenant.quota || 0, tenant.sites || 1, tenant.ilmPolicy || "2_copies");
      md += `| ${tenant.name} | ${tenant.sites || 1} | ${tenant.ilmPolicy || '2-Copy'} (${ecLabel}) | ${quota} | ${phys.toLocaleString()} GB |\n`;
    });
  } else {
    md += `| Storage VM (SVM) | Volume Name | Aggregate | Target Size | Protocols | QoS Policy |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    state.volumes.forEach(vol => {
      md += `| ${vol.svmName} | ${vol.name} | ${vol.aggregate} | ${vol.size} ${vol.sizeUnit} | ${state.protocol.toUpperCase()} | ${state.qos.policyType.toUpperCase()} |\n`;
    });
  }
  md += `\n`;
  
  // 3. High-Level Design (HLD)
  md += `## 3. High-Level Design (HLD) Topology\n`;
  md += `Below is the architectural schematic of the designed storage infrastructure showing logical client requests traversing the switching layer to the active storage nodes.\n\n`;
  md += `\`\`\`\n`;
  if (isSg) {
    md += `                 +------------------------------------------+\n`;
    md += `                 |     S3 Client Applications / SDKs        |\n`;
    md += `                 +------------------------------------------+\n`;
    md += `                                      | (HTTPS / REST)\n`;
    md += `                                      v\n`;
    md += `                 +------------------------------------------+\n`;
    md += `                 |     Grid Load Balancer Endpoint VIP      |\n`;
    md += `                 |       (${state.sgIntegrations.haVip}:${state.sgIntegrations.lbPort} / ${state.sgIntegrations.lbProtocol.toUpperCase()})        |\n`;
    md += `                 +------------------------------------------+\n`;
    md += `                    /                 |                  \\\n`;
    md += `                   /                  |                   \\\n`;
    md += `      +--------------------+ +--------------------+ +--------------------+\n`;
    md += `      |   Gateway Node 1   | |   Storage Node 2   | |   Storage Node 3   |\n`;
    md += `      |  (${state.sgIntegrations.haMembers.split(",")[0]?.trim() || 'node1'})   | |  (Metadata + Obj)  | |  (Metadata + Obj)  |\n`;
    md += `      +--------------------+ +--------------------+ +--------------------+\n`;
  } else {
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      md += `                               +-----------------------------+\n`;
      md += `                               |     ONTAP Mediator (Site C) |\n`;
      md += `                               +-----------------------------+\n`;
      md += `                                    /                   \\\n`;
      md += `                        (Heartbeat)/                     \\(Heartbeat)\n`;
      md += `                                  v                       v\n`;
      md += `               +-----------------------+              +-----------------------+\n`;
      md += `               | Site A Cluster (Local)|              | Site B Cluster (Remote|\n`;
      md += `               | (Controllers Plex 0)  |              | (Controllers Plex 1)  |\n`;
      md += `               +-----------------------+              +-----------------------+\n`;
      md += `                     |            |                         |            |\n`;
      md += `             e0a/e0b |   SyncMirror Replication Link        | e0a/e0b    |\n`;
      md += `                     +======================================+            |\n`;
      md += `                     |  - RTT: ${mcc.latency} ms                       |            |\n`;
      md += `                     |  - Distance: ${mcc.distance} km                   |            |\n`;
      md += `                     v                                      v\n`;
      md += `               +-----------------------+              +-----------------------+\n`;
      md += `               | Local Disk Shelves    |              | Remote Disk Shelves   |\n`;
      md += `               | (Plex 0 Active Mirror)|              | (Plex 1 Remote Mirror)|\n`;
      md += `               +-----------------------+              +-----------------------+\n`;
    } else {
      md += `                 +------------------------------------------+\n`;
      md += `                 |           Client Applications            |\n`;
      md += `                 +------------------------------------------+\n`;
      md += `                        | (NFS / SMB / iSCSI / NVMe)\n`;
      md += `                        v\n`;
      md += `                 +------------------------------------------+\n`;
      md += `                 |       Network Fabric Switches            |\n`;
      md += `                 |   (${state.network.switchBrand.toUpperCase()} ${state.network.portSpeed}G Multi-path Switch)    |\n`;
      md += `                 +------------------------------------------+\n`;
      md += `                   /                                      \\\n`;
      md += `                  /                                        \\\n`;
      md += `      +-------------------------+             +-------------------------+\n`;
      md += `      |    Storage Controller   |             |    Storage Controller   |\n`;
      md += `      |         Node 1          |=============|         Node 2          |\n`;
      md += `      |    (Active/Active)      |  Cluster    |    (Active/Active)      |\n`;
      md += `      +-------------------------+  Interconnect +-------------------------+\n`;
      md += `             |           |                           |           |\n`;
      md += `             |  SAS/NVMe |                           |  SAS/NVMe |\n`;
      md += `             v           v                           v           v\n`;
      md += `      +-----------------------------------------------------------------+\n`;
      md += `      |                    Disk Expansion Shelves                       |\n`;
      md += `      |           (${state.sizing.shelfType} multipath HA storage backend)              |\n`;
      md += `      +-----------------------------------------------------------------+\n`;
    }
  }
  md += `\`\`\`\n\n`;
  
  // 4. Capacity Specifications
  md += `## 4. Capacity Metrics & Overhead Analysis\n`;
  md += `| Capacity Metric | Value (GB) | Percentage |\n`;
  md += `| :--- | :--- | :--- |\n`;
  
  const rawGb = state.sizing.rawGb || 0;
  const usableGb = state.sizing.usableGb || 0;
  const logicalGb = state.sizing.logicalGb || 0;
  const parityGb = rawGb - usableGb;
  
  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    const replicationOverheadGb = rawGb / 2;
    const localProtectionGb = replicationOverheadGb - usableGb;
    md += `| **Total Raw Space (Both Sites)** | ${rawGb.toLocaleString()} GB | 100.0% |\n`;
    md += `| **SyncMirror DR Replication Copy** | ${replicationOverheadGb.toLocaleString()} GB | 50.0% |\n`;
    md += `| **Local Protection & System Overhead** | ${localProtectionGb.toLocaleString()} GB | ${(rawGb > 0 ? ((localProtectionGb / rawGb) * 100).toFixed(1) : 0)}% |\n`;
    md += `| **Active Usable Capacity** | ${usableGb.toLocaleString()} GB | ${(rawGb > 0 ? ((usableGb / rawGb) * 100).toFixed(1) : 0)}% of global |\n`;
  } else {
    md += `| **Total Raw Space** | ${rawGb.toLocaleString()} GB | 100.0% |\n`;
    md += `| **Hardware Protection (RAID/Spares)** | ${parityGb.toLocaleString()} GB | ${rawGb > 0 ? ((parityGb/rawGb)*100).toFixed(1) : 0}% |\n`;
    md += `| **System Reserve (${isSg ? 'Cassandra/OS' : 'WAFL'})** | ${Math.round(usableGb * (isSg ? 0.15 : 0.10)).toLocaleString()} GB | ${isSg ? '15.0%' : '10.0%'} of usable |\n`;
  }
  md += `| **Logical Target Capacity** | ${logicalGb.toLocaleString()} GB | Ratio: ${isSg ? 'ILM Rule Multiplier' : 'Storage Efficiency'} |\n\n`;
  
  // 5. Performance & Throughput
  md += `## 5. Performance & Throughput Estimations\n`;
  md += `The estimated metrics below represent maximum storage processing capabilities under optimal configurations:\n\n`;
  md += `* **Peak Performance Capability:** ${perf.iops.toLocaleString()} IOPS\n`;
  md += `* **Sustained Aggregate Throughput:** ${perf.throughputMb >= 1000 ? (perf.throughputMb / 1000).toFixed(2) + ' GB/s' : perf.throughputMb + ' MB/s'}\n`;
  md += `* **Average Storage Latency:** ${perf.latencyMs} ms\n\n`;
  
  // 6. Fabric Switching & Zoning Configuration
  md += `## 6. Fabric Switching & Zoning Configuration\n`;
  const switchBrand = state.network.switchBrand;
  if (switchBrand === "generic") {
    md += `The storage solution leverages generic or existing switching infrastructure with the following network configurations:\n\n`;
    md += `* **Network Type:** Ethernet\n`;
    md += `* **Target Port Speed:** ${state.network.portSpeed} GbE\n`;
    md += `* **Data path VLAN Segmentation:** VLAN ${state.network.vlanId}\n`;
    md += `* **Maximum Transmission Unit (MTU):** ${state.network.mtu} (Jumbo Frames ${state.network.mtu === "9000" ? "Enabled" : "Disabled"})\n\n`;
  } else {
    md += `The storage switching fabric utilizes dedicated **${switchBrand.toUpperCase()}** switches to establish robust multipath high-availability transport. Configuration specifications:\n\n`;
    md += `* **Switch Infrastructure Brand:** ${switchBrand === "cisco" ? "Cisco MDS/Nexus" : "Brocade SAN (FOS)"}\n`;
    md += `* **Fabric OS Version:** ${state.network.switchVersion}\n`;
    md += `* **Data Link Speed:** ${state.network.portSpeed.includes("_fc") ? state.network.portSpeed.replace("_fc", "") + " Gb FC" : state.network.portSpeed + " GbE"}\n`;
    md += `* **Data path VLAN Segmentation:** VLAN ${state.network.vlanId}\n`;
    md += `* **Maximum Transmission Unit (MTU):** ${state.network.mtu} bytes (Ethernet)\n`;
    md += `* **Fabric Zoning Policy:** ${state.network.zoningEnable ? "Active Zoning Enabled (Single-Initiator Zoning configuration commands generated)" : "Disabled / Flat Fabric Trunking"}\n\n`;
    
    if (state.network.zoningEnable && (state.protocol === "fc" || state.protocol === "fcoe" || state.protocol === "nvme_fc")) {
      md += `### Zoning Implementation Details\n`;
      md += `The SAN switch configuration automates zoning rules to partition the host adapters (HBAs) and storage target interfaces (WWPNs) into individual, secure zone membership groups. This isolates node traffic, preventing path interference and unauthorized storage volume accessibility.\n\n`;
    } else {
      md += `### Switching Configuration Details\n`;
      md += `The network switches are configured for VLAN trunking and link aggregation (LACP/Port-Channels) to distribute storage traffic across active paths, matching NetApp's Virtual Interface (VIF) and Interface Group (ifgrp) load balancing.\n\n`;
    }
  }

  // 7. Implementation & Solution Features
  md += `## 7. Implementation & Solution Features\n`;
  if (isSg) {
    md += `### High Availability and S3 Load Balancing\n`;
    md += `The grid gateway hosts are grouped into a virtual High Availability (HA) VIP mapping (IP: \`${state.sgIntegrations.haVip}\`, Name: \`${state.sgIntegrations.haGroupName}\`). Standard client port \`${state.sgIntegrations.lbPort}\` is routed via S3 Load Balancer endpoints to ensure transparent node failures without service disruption.\n\n`;
    md += `### Advanced Security & Compliance\n`;
    md += `* **TLS Profile:** Strict adherence to \`${state.sgIntegrations.tlsCompliance.toUpperCase()}\` encryption.\n`;
    md += `* **Key Management (KMS):** Cryptographic lock using \`${state.sgIntegrations.kmsProvider.toUpperCase()}\` system controls.\n`;
    if (state.version === "12.0") {
      md += `* **Security Access (STS):** Short-term IAM credentials enabled via AssumeRole: ${state.sgIntegrations.assumeRole ? "Active" : "Inactive"}.\n`;
      md += `\n### StorageGRID 12.0 Premium AI & Data Services\n`;
      md += `* **S3 Caching Layer Acceleration:** ${state.sgIntegrations.s3Caching ? "Enabled (Optimized cache for high-throughput AI workloads)" : "Disabled"}.\n`;
      const hasBranches = state.sgBuckets.some(b => b.bucketBranches);
      md += `* **Bucket Branches (Point-in-Time Clones):** ${hasBranches ? "Configured on active buckets for dataset isolation" : "Available (Supported in v12.0)"}.\n`;
    }
  } else {
    md += `### Storage Efficiency & Data Reduction\n`;
    md += `The storage array utilizes Inline Deduplication, Compression, and Compaction technologies to achieve an estimated efficiency multiplier based on the profile workloads.\n\n`;
    md += `### Quality of Service (QoS) Guarantees\n`;
    md += `To prevent "noisy-neighbor" syndrome, the solution applies QoS rules:\n`;
    md += `* **Policy Type:** ${state.qos.policyType.toUpperCase()}\n`;
    md += `* **Expected Limit (Floor):** ${state.qos.expectedIops} IOPS\n`;
    md += `* **Peak Limit (Ceiling):** ${state.qos.peakIops} IOPS (${state.qos.peakThroughput} MB/s)\n\n`;
  }

  md += `\n`;
  md += generateNetworkTrafficMatrix("markdown");
  
  return md;
}

function renderPresalesProposal() {
  const proposalWrapper = document.getElementById("previewProposalWrapper");
  if (!proposalWrapper) return;

  const isSg = state.platform === "storagegrid";
  const perf = calculatePerformanceMetrics();
  const rawGb = state.sizing.rawGb || 0;
  const usableGb = state.sizing.usableGb || 0;
  const logicalGb = state.sizing.logicalGb || 0;
  const parityGb = rawGb - usableGb;

  let html = '';
  html += '<h1>Technical Presales Solution Proposal</h1>';
  html += '<p>Detailed configuration, capacity math, performance throughput estimations, HLD diagrams, and key implementation specifications for the customer design.</p>';

  // Executive summary card
  html += '<div class="guide-card">';
  html += '  <h2>Executive Summary</h2>';
  if (isSg) {
    html += `  <p>This proposal outlines a highly scalable, distributed object storage solution based on <strong>NetApp StorageGRID v${state.version}</strong>. The solution provides industry-standard S3 compliance with geo-distributed architecture, multi-site availability, and enterprise-grade lifecycle management (ILM). It provides high durability for unstructured object data, media repositories, and analytical archives.</p>`;
  } else {
    html += `  <p>This proposal details an enterprise network storage solution based on <strong>NetApp ONTAP v${state.version}</strong>. The solution leverages advanced unified storage architecture supporting block (SAN) and file (NAS) protocols concurrently. Designed for high availability, transactional databases, virtualization platforms, and container orchestration workloads, it ensures maximum data reduction efficiencies and robust business continuity.</p>`;
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      html += `  <p>This configuration incorporates <strong>NetApp MetroCluster ${mcc.type.toUpperCase()}</strong> to deliver synchronous zero-data-loss (RPO=0) disaster recovery across a distance of <strong>${mcc.distance} km</strong> with <strong>${mcc.latency} ms RTT</strong> latency. The configuration uses an active-active dual-site architecture supported by <strong>${mcc.mediator === "mediator" ? "ONTAP Mediator" : (mcc.mediator === "tiebreaker" ? "Tiebreaker Node" : "manual DR controls")}</strong> for automated failover (AUSO) protection.</p>`;
    }
  }
  html += '</div>';

  // LLD Details
  html += '<div class="guide-card">';
  html += '  <h2>Low-Level Design (LLD) Specifications</h2>';
  html += '  <table style="width:100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.8rem;">';
  html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600; width: 40%;">Controller Hardware Node</td><td style="padding: 8px;">${state.sizing.controller}</td></tr>`;
  html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Node Scale</td><td style="padding: 8px;">${state.sizing.nodeCount} controller node(s)</td></tr>`;
  html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Disk Bay Shelf Type</td><td style="padding: 8px;">${state.sizing.shelfType}</td></tr>`;
  html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Drive Size / Type</td><td style="padding: 8px;">${state.sizing.diskSize}</td></tr>`;
  let disksLabel = "Disk Quantity per Node";
  let totalDrives = 0;
  if (isSg) {
    disksLabel = "Disk Quantity per Node";
    totalDrives = parseInt(state.sizing.nodeCount) * parseInt(state.sizing.diskCount);
  } else {
    disksLabel = "Disk Quantity per Node Pair";
    const nodePairs = parseInt(state.sizing.nodeCount) / 2;
    totalDrives = nodePairs * parseInt(state.sizing.diskCount);
    if (state.metrocluster && state.metrocluster.enabled) {
      totalDrives *= 2;
    }
  }
  html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">${disksLabel}</td><td style="padding: 8px;">${state.sizing.diskCount} drives</td></tr>`;
  html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Total Active Drives</td><td style="padding: 8px;">${totalDrives} disks</td></tr>`;
  if (isSg) {
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Active Protection Policy</td><td style="padding: 8px;">${state.sgIntegrations.ilmPolicy.toUpperCase()}</td></tr>`;
  } else {
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Aggregate RAID Type</td><td style="padding: 8px;">RAID-${state.sizing.raidType.toUpperCase()} (Group size: ${state.sizing.raidGroupSize})</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">FabricPool Cloud Tiering</td><td style="padding: 8px;">${(state.ontapFabricPool.enabled ? 'Enabled (' + state.ontapFabricPool.endpoint + ')' : 'Disabled')}</td></tr>`;
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">MetroCluster DR</td><td style="padding: 8px;">Enabled (${mcc.type.toUpperCase()} Fabric)</td></tr>`;
      html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Site-to-Site Distance</td><td style="padding: 8px;">${mcc.distance} km</td></tr>`;
      html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">Synchronous RTT Latency</td><td style="padding: 8px;">${mcc.latency} ms</td></tr>`;
      html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding: 8px; font-weight:600;">DR Mediator</td><td style="padding: 8px;">${mcc.mediator === "mediator" ? "ONTAP Mediator" : (mcc.mediator === "tiebreaker" ? "Tiebreaker Node" : "None")}</td></tr>`;
    }
  }
  html += '  </table>';
  html += '</div>';

  // HLD Diagram ASCII
  html += '<div class="guide-card">';
  html += '  <h2>High-Level Design (HLD) Topology</h2>';
  html += '  <p>Standard architectural view of network client connections mapping to switch infrastructures and active storage controller pairs:</p>';
  html += '  <pre style="background: rgba(0,0,0,0.5); padding: 12px; font-family: monospace; border-radius: 4px; color: var(--color-accent-cyan); line-height: 1.25; overflow-x: auto; font-size: 0.75rem;">';
  if (isSg) {
    html += '                 +------------------------------------------+\n';
    html += '                 |     S3 Client Applications / SDKs        |\n';
    html += '                 +------------------------------------------+\n';
    html += '                                      | (HTTPS / REST)\n';
    html += '                                      v\n';
    html += '                 +------------------------------------------+\n';
    html += '                 |     Grid Load Balancer Endpoint VIP      |\n';
    html += `                 |       (${state.sgIntegrations.haVip}:${state.sgIntegrations.lbPort} / ${state.sgIntegrations.lbProtocol.toUpperCase()})        |\n`;
    html += '                 +------------------------------------------+\n';
    html += '                    /                 |                  \\\n';
    html += '                   /                  |                   \\\n';
    html += '      +--------------------+ +--------------------+ +--------------------+\n';
    html += '      |   Gateway Node 1   | |   Storage Node 2   | |   Storage Node 3   |\n';
    html += `      |  (${state.sgIntegrations.haMembers.split(",")[0]?.trim() || 'node1'})   | |  (Metadata + Obj)  | |  (Metadata + Obj)  |\n`;
    html += '      +--------------------+ +--------------------+ +--------------------+\n';
  } else {
    if (state.metrocluster && state.metrocluster.enabled) {
      const mcc = state.metrocluster;
      html += '                               +-----------------------------+\n';
      html += '                               |     ONTAP Mediator (Site C) |\n';
      html += '                               +-----------------------------+\n';
      html += '                                    /                   \\\n';
      html += '                        (Heartbeat)/                     \\(Heartbeat)\n';
      html += '                                  v                       v\n';
      html += '               +-----------------------+              +-----------------------+\n';
      html += '               | Site A Cluster (Local)|              | Site B Cluster (Remote|\n';
      html += '               | (Controllers Plex 0)  |              | (Controllers Plex 1)  |\n';
      html += '               +-----------------------+              +-----------------------+\n';
      html += '                     |            |                         |            |\n';
      html += '             e0a/e0b |   SyncMirror Replication Link        | e0a/e0b    |\n';
      html += '                     +======================================+            |\n';
      html += `                     |  - RTT: ${mcc.latency} ms                       |            |\n`;
      html += `                     |  - Distance: ${mcc.distance} km                   |            |\n`;
      html += '                     v                                      v\n';
      html += '               +-----------------------+              +-----------------------+\n';
      html += '               | Local Disk Shelves    |              | Remote Disk Shelves   |\n';
      html += '               | (Plex 0 Active Mirror)|              | (Plex 1 Remote Mirror)|\n';
      html += '               +-----------------------+              +-----------------------+\n';
    } else {
      html += '                 +------------------------------------------+\n';
      html += '                 |           Client Applications            |\n';
      html += '                 +------------------------------------------+\n';
      html += '                        | (NFS / SMB / iSCSI / NVMe)\n';
      html += '                        v\n';
      html += '                 +------------------------------------------+\n';
      html += '                 |       Network Fabric Switches            |\n';
      html += `                 |   (${state.network.switchBrand.toUpperCase()} ${state.network.portSpeed}G Multi-path Switch)    |\n`;
      html += '                 +------------------------------------------+\n';
      html += '                   /                                      \\\n';
      html += '                  /                                        \\\n';
      html += '      +-------------------------+             +-------------------------+\n';
      html += '      |    Storage Controller   |             |    Storage Controller   |\n';
      html += '      |         Node 1          |=============|         Node 2          |\n';
      html += '      |    (Active/Active)      |  Cluster    |    (Active/Active)      |\n';
      html += '      +-------------------------+  Interconnect +-------------------------+\n';
      html += '             |           |                           |           |\n';
      html += '             |  SAS/NVMe |                           |  SAS/NVMe |\n';
      html += '             v           v                           v           v\n';
      html += '      +-----------------------------------------------------------------+\n';
      html += '      |                    Disk Expansion Shelves                       |\n';
      html += `      |           (${state.sizing.shelfType} multipath HA storage backend)              |\n`;
      html += '      +-----------------------------------------------------------------+\n';
    }
  }
  html += '  </pre>';
  html += '</div>';

  // Capacity breakdown
  html += '<div class="guide-card">';
  html += '  <h2>Capacity & Efficiency Space Calculations</h2>';
  html += '  <table style="width:100%; border-collapse: collapse; font-size: 0.8rem;">';
  html += '    <thead><tr style="border-bottom: 2px solid rgba(255,255,255,0.2);"><th style="padding:8px; text-align:left;">Metric</th><th style="padding:8px; text-align:left;">Capacity (GB)</th><th style="padding:8px; text-align:left;">Percentage</th></tr></thead>';
  
  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    const replicationOverheadGb = rawGb / 2;
    const localProtectionGb = replicationOverheadGb - usableGb;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">Total Raw Space (Both Sites)</td><td style="padding:8px;">${rawGb.toLocaleString()} GB</td><td style="padding:8px;">100.0%</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">SyncMirror DR Replication Copy</td><td style="padding:8px;">${replicationOverheadGb.toLocaleString()} GB</td><td style="padding:8px;">50.0%</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">Local Protection & System Overhead</td><td style="padding:8px;">${localProtectionGb.toLocaleString()} GB</td><td style="padding:8px;">${(rawGb > 0 ? ((localProtectionGb/rawGb)*100).toFixed(1) : 0)}%</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">Active Usable Capacity</td><td style="padding:8px;">${usableGb.toLocaleString()} GB</td><td style="padding:8px;">${(rawGb > 0 ? ((usableGb/rawGb)*100).toFixed(1) : 0)}% of global</td></tr>`;
  } else {
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">Total Raw Space</td><td style="padding:8px;">${rawGb.toLocaleString()} GB</td><td style="padding:8px;">100.0%</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">Hardware Protection Overhead</td><td style="padding:8px;">${parityGb.toLocaleString()} GB</td><td style="padding:8px;">${(rawGb > 0 ? ((parityGb/rawGb)*100).toFixed(1) : 0)}%</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">System reserve (${(isSg ? 'Cassandra/OS' : 'WAFL')})</td><td style="padding:8px;">${Math.round(usableGb * (isSg ? 0.15 : 0.10)).toLocaleString()} GB</td><td style="padding:8px;">${(isSg ? '15.0%' : '10.0%')}</td></tr>`;
  }
  html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:8px; font-weight:600;">Logical Target Capacity</td><td style="padding:8px;">${logicalGb.toLocaleString()} GB</td><td style="padding:8px;">${(logicalGb >= usableGb ? 'Savings Factor: ' + (logicalGb/Math.max(1, usableGb)).toFixed(1) + 'x' : 'Retention Ratio: ' + ((logicalGb/Math.max(1, usableGb))*100).toFixed(0) + '%')}</td></tr>`;
  html += '  </table>';
  html += '</div>';

  // Performance specs
  html += '<div class="guide-card">';
  html += '  <h2>Performance & Latency Estimations</h2>';
  html += '  <ul>';
  html += `    <li><strong>Est. Max Input/Output Operations (IOPS):</strong> ${perf.iops.toLocaleString()} IOPS</li>`;
  html += `    <li><strong>Sustained Bandwidth Throughput:</strong> ${(perf.throughputMb >= 1000 ? (perf.throughputMb/1000).toFixed(2) + ' GB/s' : perf.throughputMb + ' MB/s')}</li>`;
  html += `    <li><strong>Estimated Latency Response Profile:</strong> ${perf.latencyMs} ms</li>`;
  html += '  </ul>';
  html += '</div>';

  // Fabric Switching and Zoning Specs
  html += '<div class="guide-card">';
  html += '  <h2>Fabric Switching & Zoning Configuration</h2>';
  const switchBrand = state.network.switchBrand;
  if (switchBrand === "generic") {
    html += '  <p>The network topology utilizes generic/existing switches with standard Ethernet configurations:</p>';
    html += '  <table style="width:100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 12px;">';
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600; width:40%;">Switching Fabric Type</td><td style="padding:6px;">Generic Ethernet</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">Switch Port Speed</td><td style="padding:6px;">${state.network.portSpeed} GbE</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">Data path VLAN</td><td style="padding:6px;">VLAN ${state.network.vlanId}</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">MTU Frame Size</td><td style="padding:6px;">${state.network.mtu} bytes (${state.network.mtu === "9000" ? "Jumbo Frames" : "Standard"})</td></tr>`;
    html += '  </table>';
  } else {
    html += `  <p>The design includes dedicated high-availability <strong>${switchBrand === "cisco" ? "Cisco MDS/Nexus" : "Brocade SAN"}</strong> switch fabrics:</p>`;
    html += '  <table style="width:100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 12px;">';
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600; width:40%;">Switch Infrastructure</td><td style="padding:6px;">${switchBrand === "cisco" ? "Cisco MDS/Nexus" : "Brocade SAN"}</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">Fabric OS Version</td><td style="padding:6px;">${state.network.switchVersion}</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">Link Speed</td><td style="padding:6px;">${state.network.portSpeed.includes("_fc") ? state.network.portSpeed.replace("_fc", "") + " Gb FC" : state.network.portSpeed + " GbE"}</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">Data path VLAN</td><td style="padding:6px;">VLAN ${state.network.vlanId}</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">MTU Frame Size</td><td style="padding:6px;">${state.network.mtu} bytes</td></tr>`;
    html += `    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><td style="padding:6px; font-weight:600;">Fabric Zoning Status</td><td style="padding:6px;">${state.network.zoningEnable ? "Active Zoning Enabled" : "Disabled / Flat Fabric"}</td></tr>`;
    html += '  </table>';
  }
  html += '</div>';

  // Implementation Specifications
  html += '<div class="guide-card">';
  html += '  <h2>Key Infrastructure Features</h2>';
  if (isSg) {
    html += `  <p><strong>Gateway High Availability:</strong> Node requests balancer configured under Virtual IP group <code>${state.sgIntegrations.haGroupName}</code> (${state.sgIntegrations.haVip}) using port <code>${state.sgIntegrations.lbPort}</code>.</p>`;
    html += `  <p><strong>Crypto Verification:</strong> Fully secured data paths complying with strict <code>${state.sgIntegrations.tlsCompliance.toUpperCase()}</code> TLS profiles using external <code>${state.sgIntegrations.kmsProvider.toUpperCase()}</code> key encryption provider.</p>`;
  } else {
    html += '  <p><strong>Data Redundancy:</strong> Parity groups utilize double-failure recovery algorithms mapped to node spares.</p>';
    html += `  <p><strong>Host-side Quality of Service:</strong> Volumes are controlled via <code>${state.qos.policyType.toUpperCase()}</code> policies. Peak ceiling constraints set to <code>${state.qos.peakIops}</code> IOPS, with guaranteed floor allocations of <code>${state.qos.expectedIops}</code> IOPS.</p>`;
  }
  html += '</div>';

  html += generateNetworkTrafficMatrix("html");

  proposalWrapper.innerHTML = html;
}

// 15. DYNAMIC ARCHITECTURE GUIDE RENDERING & TOPOLOGY
function renderArchitectureGuide() {
  const guideWrapper = document.getElementById("previewGuideWrapper");
  if (!guideWrapper) return;

  const svgContent = generateSvgTopology();
  const hypervisor = state.workload.hypervisor;
  const db = state.workload.db;
  const proto = state.protocol.toUpperCase();
  
  let html = '';

  // 1. Title & Topology Container
  html += '<h1>Storage Architecture Guide</h1>';
  html += '<p>Below is the generated physical and logical topology mapping for this deployment scenario. The diagrams and guidelines update dynamically based on your configuration inputs.</p>';
  
  html += '<div class="topology-svg-container">';
  html += svgContent;
  html += '</div>';

  // 2. Overview Card
  let platformLabel = "ONTAP Cluster";
  if (state.platform === "ontap") {
    if (state.ontapPlatform === "aff") platformLabel = "ONTAP AFF (All-Flash FAS)";
    else if (state.ontapPlatform === "asa") platformLabel = "ONTAP ASA (All-Flash SAN Array)";
    else if (state.ontapPlatform === "afx") platformLabel = "ONTAP FAS (Capacity Hybrid)";
  } else {
    platformLabel = "StorageGRID Object Store";
  }

  html += '<div class="guide-card">';
  html += '  <h2>Architectural Overview</h2>';
  html += '  <p>This design utilizes the <strong>' + platformLabel + '</strong> platform with a robust network storage layout to support high-availability operations. The configurations degrade legacy syntax and elevate services depending on the specified ONTAP/OS versions.</p>';
  
  if (state.platform === "ontap") {
    html += '  <table style="width:100%;">';
    html += '    <thead>';
    html += '      <tr>';
    html += '        <th>Resource Name</th>';
    html += '        <th>SVM Owner</th>';
    html += '        <th>Aggregate</th>';
    html += '        <th>Size</th>';
    html += '        <th>Est. IOPS</th>';
    html += '        <th>Encryption</th>';
    html += '        <th>FabricPool</th>';
    html += '      </tr>';
    html += '    </thead>';
    html += '    <tbody>';
    state.volumes.forEach(v => {
      let fpPolicy = v.fabricpool || "none";
      if (fpPolicy === true) fpPolicy = "auto";
      if (fpPolicy === false) fpPolicy = "none";
      html += '      <tr>';
      html += '        <td><strong>' + v.name + '</strong></td>';
      html += '        <td>' + v.svmName + '</td>';
      html += '        <td>' + v.aggregate + '</td>';
      html += '        <td>' + v.size + ' ' + v.sizeUnit + '</td>';
      html += '        <td>' + (v.iops || 1000) + '</td>';
      html += '        <td>' + (v.encryption ? '<span style="color:var(--color-success)">NVE Active</span>' : 'None') + '</td>';
      let coolingSuffix = "";
      if ((fpPolicy === "auto" || fpPolicy === "snapshot-only") && v.coolingDays && v.coolingDays !== 31) {
        coolingSuffix = " (" + v.coolingDays + "d)";
      }
      html += '        <td>' + (fpPolicy !== "none" ? '<span style="color:var(--color-accent-cyan)">' + fpPolicy.toUpperCase() + coolingSuffix + '</span>' : 'None') + '</td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';
  } else {
    html += '  <h3 style="margin-top:15px; margin-bottom:8px; font-size:14px; color:#fff;">Tenant Accounts</h3>';
    html += '  <table style="width:100%; margin-bottom: 20px;">';
    html += '    <thead>';
    html += '      <tr>';
    html += '        <th>Tenant Name</th>';
    html += '        <th>Quota Limit</th>';
    html += '        <th>Access Protocol</th>';
    html += '        <th>Platform Services</th>';
    html += '      </tr>';
    html += '    </thead>';
    html += '    <tbody>';
    state.sgTenants.forEach(t => {
      html += '      <tr>';
      html += '        <td><strong>' + t.name + '</strong></td>';
      html += '        <td>' + (t.quota ? t.quota + ' GB' : 'Unlimited') + '</td>';
      html += '        <td>' + t.protocol.toUpperCase() + '</td>';
      html += '        <td>' + (t.allowPlatformServices ? '<span style="color:var(--color-success)">Allowed</span>' : 'Disabled') + '</td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';

    html += '  <h3 style="margin-top:15px; margin-bottom:8px; font-size:14px; color:#fff;">S3 Buckets & Platform Integrations</h3>';
    html += '  <table style="width:100%;">';
    html += '    <thead>';
    html += '      <tr>';
    html += '        <th>Bucket Name</th>';
    html += '        <th>Owner Tenant</th>';
    html += '        <th>Region</th>';
    html += '        <th>Versioning</th>';
    html += '        <th>Object Lock</th>';
    html += '        <th>Active Services</th>';
    html += '      </tr>';
    html += '    </thead>';
    html += '    <tbody>';
    state.sgBuckets.forEach(b => {
      const services = [];
      if (b.eventNotifications) services.push("SNS");
      if (b.cloudMirror) services.push("CloudMirror");
      if (b.searchIntegration) services.push("Elasticsearch");
      const serviceStr = services.length > 0 ? services.join(", ") : "None";
      const lockStr = b.objectLock ? '<span style="color:var(--color-warning)">WORM (' + b.retentionDays + ' Days)</span>' : 'Disabled';
      html += '      <tr>';
      html += '        <td><strong>' + b.name + '</strong></td>';
      html += '        <td>' + b.tenantName + '</td>';
      html += '        <td>' + b.region + '</td>';
      html += '        <td>' + (b.versioning ? '<span style="color:var(--color-success)">Enabled</span>' : 'Disabled') + '</td>';
      html += '        <td>' + lockStr + '</td>';
      html += '        <td>' + serviceStr + '</td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';
  }
  html += '</div>';

  // 3. Step-by-Step Checklist
  html += '<div class="guide-card">';
  html += '  <h2>Step-by-Step Deployment Checklist</h2>';
  html += '  <p>Track your physical and logical storage implementation steps below:</p>';
  html += '  <div class="guide-checkbox-list">';

  const checklist = [];
  
  if (state.platform === "ontap") {
    if (state.network.switchBrand !== "generic") {
      if (["fc", "fcoe", "nvme_fc"].includes(state.protocol)) {
        checklist.push("Configure fabric switch zoning aliases and active zoneset on the " + state.network.switchBrand.toUpperCase() + " switch.");
      } else {
        checklist.push("Provision VLAN " + state.network.vlanId + " and set MTU to " + state.network.mtu + " on all Ethernet switch interfaces.");
      }
    }

    state.svms.forEach(s => {
      checklist.push("Build Storage Virtual Machine (SVM) <strong>" + s.name + "</strong> and configure LIF interfaces mapped to IP <strong>" + s.dataIp + "</strong>.");
    });

    const needsKeyManager = state.volumes.some(v => v.encryption);
    if (needsKeyManager) {
      checklist.push("Enable Onboard Key Manager on the cluster nodes using <code>security key-manager onboard enable</code>.");
    }

    if (state.ontapFabricPool.enabled) {
      checklist.push("Register StorageGRID FabricPool cloud tier target <code>sg_fabricpool_target</code> pointing to <code>" + state.ontapFabricPool.endpoint + "</code>.");
    }

    state.volumes.forEach(v => {
      let fpPolicy = v.fabricpool || "none";
      if (fpPolicy === true) fpPolicy = "auto";
      if (fpPolicy === false) fpPolicy = "none";
      
      let suffix = "";
      if (fpPolicy !== "none") {
        suffix = " (Tiering active, policy: <code>" + fpPolicy.toUpperCase() + "</code>)";
      }
      checklist.push("Create storage volume <strong>" + v.name + "</strong> in aggregate <strong>" + v.aggregate + "</strong> with online efficiency policies" + suffix + ".");
      
      if (isSanProtocol(state.protocol)) {
        const isNvme = state.protocol.startsWith("nvme");
        const unitLabel = isNvme ? "Namespace" : "LUN";
        checklist.push("Provision nested " + unitLabel + "s inside Volume <strong>" + v.name + "</strong> and map them to igroup mapping files.");
      }
    });

    if (hypervisor === "esxi") {
      checklist.push("Mount datastores on ESXi servers using recommended NFS TCP / SAN iSCSI protocol tuning configurations.");
    } else if (hypervisor === "hyperv") {
      checklist.push("Configure Windows Server MPIO features, register iSCSI targets, and enable Cluster Shared Volumes (CSV).");
    } else if (hypervisor === "kvm") {
      checklist.push("Install multipath daemon on target KVM compute nodes and discover mapped LUN block endpoints.");
    }

    if (db === "oracle") {
      checklist.push("Initialize Oracle Grid ASM disks, partition disk groups (DATA, REDO, ARCH) and adjust Grid ownership profiles.");
    } else if (db === "mssql") {
      checklist.push("Format raw volumes inside Windows with NTFS 64KB Allocation Unit Size and link SQL instances.");
    } else if (db === "postgres") {
      checklist.push("Deploy separate pg_data and pg_wal directories on designated NVMe mount endpoints.");
    }

    if (state.trident.enabled) {
      checklist.push("Deploy dynamic Kubernetes PVC binding definitions using Trident driver orchestrator backend classes.");
    }
  } else {
    // StorageGRID
    if (state.network.switchBrand !== "generic") {
      checklist.push("Configure switch VLAN " + state.network.vlanId + " and set MTU " + state.network.mtu + " for grid gateway interfaces on the " + state.network.switchBrand.toUpperCase() + " switch.");
    }
    checklist.push("Create Grid HA Group <strong>" + (state.sgIntegrations.haGroupName || "ha-gateway-group") + "</strong> with VIP <strong>" + (state.sgIntegrations.haVip || "192.168.10.50") + "</strong>.");
    checklist.push("Configure Load Balancer Endpoint <strong>" + (state.sgIntegrations.lbEndpointName || "s3-load-balancer") + "</strong> on port <strong>" + (state.sgIntegrations.lbPort || 10443) + "</strong>.");
    
    state.sgTenants.forEach(t => {
      checklist.push("Provision Tenant account <strong>" + t.name + "</strong> with protocol <strong>" + t.protocol.toUpperCase() + "</strong> and quota <strong>" + (t.quota ? t.quota + " GB" : "Unlimited") + "</strong>.");
    });
    
    state.sgBuckets.forEach(b => {
      let details = [];
      if (b.versioning) details.push("Versioning");
      if (b.objectLock) details.push("Object Lock (" + b.retentionDays + " Days)");
      if (b.eventNotifications) details.push("SNS Notifications");
      if (b.cloudMirror) details.push("CloudMirror Replication");
      if (b.searchIntegration) details.push("Elasticsearch Indexing");
      
      const detailsStr = details.length > 0 ? " (" + details.join(", ") + ")" : "";
      checklist.push("Create S3 Bucket <strong>" + b.name + "</strong> owned by Tenant <strong>" + b.tenantName + "</strong>" + detailsStr + ".");
    });
    checklist.push("Activate global ILM Policy with rule set <strong>" + state.sgIntegrations.ilmPolicy.toUpperCase() + "</strong>.");
  }

  checklist.forEach((itemText, idx) => {
    html += '    <label class="guide-checkbox-item" for="chk_guide_' + idx + '">';
    html += '      <input type="checkbox" id="chk_guide_' + idx + '">';
    html += '      <span class="guide-checkbox-label">' + itemText + '</span>';
    html += '    </label>';
  });

  html += '  </div>';
  html += '</div>';

  // 4. Engineering Justifications Card
  html += '<div class="guide-card">';
  html += '  <h2>Engineering Justifications</h2>';
  
  if (state.platform === "ontap") {
    if (db !== "none") {
      html += '  <h3>Database Tuning: ' + db.toUpperCase() + '</h3>';
      if (db === "oracle") {
        html += '  <p><strong>REDO and ARCH separation:</strong> Hard disk aggregate pathways are optimized by separating volatile REDO operations from high-volume transaction writes. This setup ensures predictable database writer (DBWR) throughput.</p>';
      } else if (db === "mssql") {
        html += '  <p><strong>NTFS 64KB Sector Alignment:</strong> Standard SQL Server pages are 8KB, clustered in 64KB extents. Setting the filesystem cluster unit size to 64KB prevents split I/O reads and optimizes bulk transfer operations.</p>';
      } else if (db === "postgres") {
        html += '  <p><strong>WAL Write Isolation:</strong> Write-ahead logs (WAL) are written sequentially. Placing them on a high-speed disk aggregate prevents random block I/O of index updates from interrupting the WAL flush rate.</p>';
      }
    }

    if (hypervisor !== "none") {
      html += '  <h3>Virtualization Pathing: ' + hypervisor.toUpperCase() + '</h3>';
      if (hypervisor === "esxi") {
        html += '  <p><strong>Network Jumbo Frames:</strong> Operating with MTU 9000 reduces packet fragmentation, decreases network CPU interrupts, and yields up to 25% performance improvement in sequential storage workloads.</p>';
      } else if (hypervisor === "hyperv") {
        html += '  <p><strong>Registry Timeout Adjustments:</strong> Modifying the host iSCSI connection timeout threshold from 20s to 60s protects guest VMs from cluster failures during storage node restarts.</p>';
      }
    }

    if (state.ontapFabricPool.enabled) {
      html += '  <h3>FabricPool Cloud Tiering</h3>';
      html += '  <p><strong>Transparent Storage Tiering:</strong> Attaching high-capacity StorageGRID S3 buckets as cloud targets allows ONTAP SSD aggregates to seamlessly release cold, inactive blocks. Active metadata remains local, preserving high performance while shrinking local physical storage costs.</p>';
    }

    html += '  <h3>Storage Efficiency Engines</h3>';
    html += '  <p><strong>Efficiency Justification:</strong> Inline deduplication, compression, and compaction operate on ONTAP systems concurrently. Data is compressed before being written to disk, extending SSD endurance and space optimization.</p>';
  } else {
    html += '  <h3>High Availability & Load Balancing</h3>';
    html += '  <p><strong>Virtual IP VIP Resilience:</strong> Gateway nodes operate in an Active-Active or Active-Backup configuration using Keepalived HA groups. Should a physical gateway fail, the S3 endpoint VIP instantly shifts to a healthy host, avoiding application traffic disruption.</p>';
    html += '  <p><strong>Dedicated S3 Port (LBE):</strong> S3 clients connect via Load Balancer ports (e.g. ' + (state.sgIntegrations.lbPort || 10443) + ') with integrated SSL termination. This isolates grid admin interfaces from application read/write streams.</p>';

    html += '  <h3>Compliance and Data Durability</h3>';
    html += '  <p><strong>S3 Object Lock (WORM):</strong> Bucket retention prevents objects from being overwritten, deleted, or modified during the configured preservation duration. This satisfies regulatory security audits and prevents ransomware encryption.</p>';
    html += '  <p><strong>Platform Services Integration:</strong> Asynchronously triggers events (SNS/Webhooks), mirror copies (CloudMirror), or custom metadata search indexes (Elasticsearch) on ingest, extending S3 storage to serverless cloud tasks.</p>';
    if (state.version === "12.0") {
      html += '  <h3>StorageGRID 12.0 High-Performance AI Features</h3>';
      html += '  <p><strong>Point-in-Time Bucket Branches:</strong> Allows developers to instantly spin up space-efficient, read-write dataset clones. This enables rapid AI iteration and testing on copy-on-write datasets without duplicating storage.</p>';
      if (state.sgIntegrations.s3Caching) {
        html += '  <p><strong>S3 Caching Layer Enabled:</strong> Accelerates high-performance computing (HPC) and AI model training workloads by caching active datasets at near-line rate speed.</p>';
      }
      if (state.sgIntegrations.assumeRole) {
        html += '  <p><strong>IAM Assume Role (STS):</strong> Secures application connections by vending short-term session credentials for tenants instead of static access keys.</p>';
      }
    }
  }
  html += '</div>';

  html += generateNetworkTrafficMatrix("html");

  guideWrapper.innerHTML = html;
}

// 16b. PHYSICAL CABLING SVG GENERATOR
function generateSvgPhysicalCabling() {
  const model = state.sizing.controller;
  const nodeCount = parseInt(state.sizing.nodeCount) || 2;
  const clusterCabling = state.sizing.clusterCabling;
  const switchModel = state.sizing.clusterSwitchModel;
  const shelfType = state.sizing.shelfType;
  const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
  const ports = getControllerPorts(model);
  const proto = state.protocol;

  const isSg = state.platform === "storagegrid";
  const switchAName = (state.customSwitchNames && state.customSwitchNames.switchA) || "Switch-A";
  const switchBName = (state.customSwitchNames && state.customSwitchNames.switchB) || "Switch-B";
  const getNodeName = (x) => state.customNodeNames[x - 1] || `Node ${x}`;

  if (isSg) {
    const svgWidth = 800;
    const svgHeight = 550;
    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent; font-family:inherit;">`;
    
    svg += `  <defs>
      <linearGradient id="sgNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(30, 41, 59, 0.98)"/>
        <stop offset="100%" stop-color="rgba(15, 23, 42, 0.98)"/>
      </linearGradient>
      <linearGradient id="gridSwitchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(0, 242, 254, 0.25)"/>
        <stop offset="100%" stop-color="rgba(0, 242, 254, 0.05)"/>
      </linearGradient>
      <linearGradient id="clientSwitchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(168, 85, 247, 0.25)"/>
        <stop offset="100%" stop-color="rgba(168, 85, 247, 0.05)"/>
      </linearGradient>
      <linearGradient id="adminSwitchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255, 255, 255, 0.2)"/>
        <stop offset="100%" stop-color="rgba(255, 255, 255, 0.05)"/>
      </linearGradient>
    </defs>`;

    svg += `  <!-- Admin Switch -->
    <g transform="translate(40, 20)">
      <rect width="180" height="40" rx="4" fill="url(#adminSwitchGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <text x="90" y="18" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Admin Network Switch</text>
      <text x="90" y="30" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">1G/10G Ethernet Fabric</text>
    </g>`;

    svg += `  <!-- Grid Switches -->
    <g transform="translate(260, 20)">
      <rect width="240" height="40" rx="4" fill="url(#gridSwitchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1"/>
      <text x="120" y="18" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Grid Network Switches (Bonded A/B)</text>
      <text x="120" y="30" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">10G/25G/100G High-Speed Fabric</text>
    </g>`;

    svg += `  <!-- Client Switches -->
    <g transform="translate(520, 20)">
      <rect width="240" height="40" rx="4" fill="url(#clientSwitchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1"/>
      <text x="120" y="18" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Client Network Switches (Bonded A/B)</text>
      <text x="120" y="30" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">10G/25G S3 Gateway Fabric</text>
    </g>`;

    const activeNodes = Math.min(4, state.sizing.nodeCount);
    const ctrlModel = state.sizing.controller;
    
    function drawSgPort(x, y, label, type) {
      let stroke = "rgba(255,255,255,0.3)";
      let fill = "rgba(255,255,255,0.05)";
      let text = "#94a3b8";
      if (type === "grid") { stroke = "rgba(0,242,254,0.6)"; fill = "rgba(0,242,254,0.1)"; text = "#00f2fe"; }
      else if (type === "client") { stroke = "rgba(168,85,247,0.6)"; fill = "rgba(168,85,247,0.1)"; text = "#a855f7"; }
      else if (type === "admin") { stroke = "rgba(255,255,255,0.6)"; fill = "rgba(255,255,255,0.1)"; text = "#fff"; }
      
      return `
        <rect x="${x}" y="${y}" width="22" height="14" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
        <text x="${x + 11}" y="${y + 10}" text-anchor="middle" fill="${text}" font-size="7" font-weight="700" font-family="monospace">${label}</text>
      `;
    }

    for (let i = 0; i < activeNodes; i++) {
      const yOff = 100 + i * 110;
      
      svg += `  <!-- Node ${i+1} Controller -->
      <g transform="translate(40, ${yOff})">
        <rect width="720" height="70" rx="6" fill="url(#sgNodeGrad)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
        <text x="15" y="24" fill="#fff" font-size="10" font-weight="700">StorageGRID Node ${i+1} (${ctrlModel})</text>
        
        <text x="15" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">ADMIN</text>
        <text x="85" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">GRID NETWORK (BONDED)</text>
        <text x="215" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">CLIENT NETWORK (BONDED)</text>
      </g>`;
      
      svg += drawSgPort(55, yOff + 46, "ADM", "admin");
      
      svg += drawSgPort(125, yOff + 46, "1", "grid");
      svg += drawSgPort(155, yOff + 46, "3", "grid");
      
      svg += drawSgPort(255, yOff + 46, "2", "client");
      svg += drawSgPort(285, yOff + 46, "4", "client");
      
      svg += `  <path d="M 66 ${yOff + 46} L 66 ${yOff + 25} L 130 60" stroke="rgba(255,255,255,0.4)" stroke-dasharray="2,2" stroke-width="1.2" fill="none"/>`;
      
      svg += `  <path d="M 136 ${yOff + 46} L 136 ${yOff + 15} L 320 60" stroke="#00f2fe" stroke-width="1.5" fill="none" opacity="0.75"/>`;
      svg += `  <path d="M 166 ${yOff + 46} L 166 ${yOff + 20} L 440 60" stroke="#00f2fe" stroke-width="1.5" fill="none" opacity="0.75"/>`;
      
      const isCompute = ["SG100", "SG110", "SG1000", "SG1100"].includes(ctrlModel);
      if (!isCompute) {
        svg += `  <path d="M 266 ${yOff + 46} L 266 ${yOff + 15} L 580 60" stroke="#a855f7" stroke-width="1.5" fill="none" opacity="0.75"/>`;
        svg += `  <path d="M 296 ${yOff + 46} L 296 ${yOff + 20} L 700 60" stroke="#a855f7" stroke-width="1.5" fill="none" opacity="0.75"/>`;
      }
    }
    
    if (state.sizing.nodeCount > 4) {
      svg += `  <!-- Node count overflow notice -->
      <g transform="translate(40, 520)">
        <text x="360" y="15" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8.5">Note: Displaying first 4 nodes of the configured ${state.sizing.nodeCount}-node grid in the diagram.</text>
      </g>`;
    }
    
    svg += `</svg>`;
    return svg;
  }

  // Dedicated MetroCluster IP/FC Physical Cabling Layout [NEW]
  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    const mcc = state.metrocluster;
    const isIp = mcc.type === "ip";
    const mediatorType = mcc.mediator === "mediator" ? "ONTAP Mediator" : (mcc.mediator === "tiebreaker" ? "Tiebreaker Node" : "None");
    const shelfType = state.sizing.shelfType;
    const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
    const hasFabricPool = state.ontapFabricPool && state.ontapFabricPool.enabled;
    
    const scale = parseInt(mcc.scale) || 4;
    const halfNodes = scale / 2;
    const nodesPerSite = halfNodes;

    const numPairs = Math.max(1, halfNodes / 2);
    const shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
    const sizingInfo = getExpansionCardsAndPorts(model, shelfType, shelvesPerPair);
    const cardsNeeded = sizingInfo.cards.length;
    const nodeHeight = 55 + cardsNeeded * 18;
    const nodeSpacing = 85 + cardsNeeded * 18;

    const startY = 60;
    const storageStartY = Math.max(startY + nodesPerSite * nodeSpacing, startY + 245) + 15;
    const svgWidth = 1000;
    const svgHeight = storageStartY + shelfCount * 60 + (hasFabricPool ? 120 : 40);

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent; font-family:inherit;">`;
    
    svg += `  <style>
      @keyframes flow { to { stroke-dashoffset: -20; } }
      .animated-flow { stroke-dasharray: 6, 4; animation: flow 1.2s linear infinite; }
      .heartbeat-flow { stroke-dasharray: 2; animation: flow 1.5s linear infinite; }
    </style>
    <defs>
      <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(30, 41, 59, 0.95)"/>
        <stop offset="100%" stop-color="rgba(15, 23, 42, 0.95)"/>
      </linearGradient>
      <linearGradient id="shelfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(16, 185, 129, 0.15)"/>
        <stop offset="100%" stop-color="rgba(15, 23, 42, 0.6)"/>
      </linearGradient>
      <linearGradient id="switchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(0, 242, 254, 0.2)"/>
        <stop offset="100%" stop-color="rgba(0, 242, 254, 0.05)"/>
      </linearGradient>
      <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(0, 242, 254, 0.8)"/>
        <stop offset="100%" stop-color="rgba(168, 85, 247, 0.8)"/>
      </linearGradient>
    </defs>`;

    function drawCompactPort(x, y, label, type) {
      let stroke = "rgba(255,255,255,0.3)";
      let fill = "rgba(255,255,255,0.05)";
      let text = "#94a3b8";
      if (type === "cluster") { stroke = "rgba(0,242,254,0.6)"; fill = "rgba(0,242,254,0.1)"; text = "#00f2fe"; }
      else if (type === "storage") { stroke = "rgba(16,185,129,0.6)"; fill = "rgba(16,185,129,0.1)"; text = "#10b981"; }
      else if (type === "data") { stroke = "rgba(168,85,247,0.6)"; fill = "rgba(168,85,247,0.1)"; text = "#a855f7"; }
      else if (type === "mgmt") { stroke = "rgba(255,255,255,0.6)"; fill = "rgba(255,255,255,0.1)"; text = "#fff"; }
      else if (type === "mc") { stroke = "rgba(245,158,11,0.6)"; fill = "rgba(245,158,11,0.1)"; text = "#f59e0b"; }

      return `
        <rect x="${x}" y="${y}" width="18" height="12" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="0.75"/>
        <text x="${x + 9}" y="${y + 8}" text-anchor="middle" fill="${text}" font-size="6" font-weight="700" font-family="monospace">${label}</text>
      `;
    }

    // Header labels
    svg += `<text x="215" y="35" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">Site A (Local Cluster)</text>`;
    svg += `<text x="785" y="35" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">Site B (Remote DR Site)</text>`;

    // --- SITE A COMPONENTS ---
    // Nodes
    for (let i = 0; i < nodesPerSite; i++) {
      const yOff = startY + i * nodeSpacing;
      svg += `  <!-- Site A Node ${i+1} -->
      <g transform="translate(20, ${yOff})">
        <rect width="210" height="${nodeHeight}" rx="5" fill="url(#nodeGrad)" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
        <text x="12" y="16" fill="#fff" font-size="9" font-weight="700">${getNodeName(i+1)} (${model})</text>
        <text x="12" y="28" fill="var(--text-muted)" font-size="7">ONTAP Controller</text>
      </g>`;
      
      // Node Ports
      svg += drawCompactPort(30, yOff + 36, ports.cluster[0], "cluster");
      svg += drawCompactPort(51, yOff + 36, ports.cluster[1], "cluster");
      svg += drawCompactPort(72, yOff + 36, ports.storage[0], "storage");
      svg += drawCompactPort(93, yOff + 36, ports.storage[1], "storage");
      svg += drawCompactPort(114, yOff + 36, ports.management, "mgmt");
      svg += drawCompactPort(135, yOff + 36, ports.data[0], "data");
      svg += drawCompactPort(156, yOff + 36, ports.data[1], "data");
      svg += drawCompactPort(177, yOff + 36, isIp ? "e5a" : "fc1", "mc");
      svg += drawCompactPort(198, yOff + 36, isIp ? "e5b" : "fc2", "mc");

      // Draw expansion card ports
      sizingInfo.cards.forEach((card, c) => {
        const slotY = yOff + 54 + c * 18;
        svg += drawCompactPort(72, slotY, card.ports[0], "storage");
        svg += drawCompactPort(93, slotY, card.ports[1], "storage");
        svg += `  <text x="114" y="${slotY + 8}" fill="rgba(255,255,255,0.4)" font-size="5.5" font-weight="700">SLOT ${card.slot}</text>`;
      });
    }

    // Site A Switches
    const switchA1Label = isIp ? "MC-Sw A1" : "FC-Sw A1";
    const switchB1Label = isIp ? "MC-Sw B1" : "FC-Sw B1";
    const switchTypeSub = isIp ? "Peering IP Fabric" : "Brocade FC SAN";

    if (nodesPerSite > 1) {
      svg += `  <!-- Site A Cluster Switches -->
      <g transform="translate(260, 65)">
        <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="0.75"/>
        <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Cluster Sw 1</text>
        <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Cluster Fabric A</text>
      </g>
      <g transform="translate(260, 105)">
        <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="0.75"/>
        <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Cluster Sw 2</text>
        <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Cluster Fabric B</text>
      </g>`;
    }

    svg += `  <!-- Site A MetroCluster Peering Switches -->
    <g transform="translate(360, 65)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(245, 158, 11, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">${switchA1Label}</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">${switchTypeSub} A</text>
    </g>
    <g transform="translate(360, 105)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(245, 158, 11, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">${switchB1Label}</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">${switchTypeSub} B</text>
    </g>
    
    <!-- Site A Mgmt & Data Switches -->
    <g transform="translate(260, 165)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(255,255,255,0.15)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Mgmt Sw A</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">1G RJ45 Fabric</text>
    </g>
    <g transform="translate(360, 165)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Data Sw A1</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Data Fabric A</text>
    </g>
    <g transform="translate(360, 205)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Data Sw B1</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Data Fabric B</text>
    </g>`;

    // Site A Shelves
    for (let s = 1; s <= shelfCount; s++) {
      const yOff = storageStartY + (s - 1) * 60;
      svg += `  <!-- Site A Shelf A${s} -->
      <g transform="translate(20, ${yOff})">
        <rect width="210" height="45" rx="3.5" fill="url(#shelfGrad)" stroke="rgba(16,185,129,0.15)" stroke-width="0.8"/>
        <text x="10" y="15" fill="#fff" font-size="8" font-weight="700">Shelf A${s} (${shelfType})</text>
        <text x="10" y="26" fill="var(--text-muted)" font-size="7">SAS/NVMe Multipath Loops</text>
      </g>`;
      svg += drawCompactPort(115, yOff + 30, "e0a", "storage");
      svg += drawCompactPort(135, yOff + 30, "e0b", "storage");
      svg += drawCompactPort(175, yOff + 30, "e0a", "storage");
      svg += drawCompactPort(195, yOff + 30, "e0b", "storage");
    }

    // --- SITE B COMPONENTS ---
    // Nodes
    for (let i = 0; i < nodesPerSite; i++) {
      const yOff = startY + i * nodeSpacing;
      const nodeNum = halfNodes + i + 1;
      svg += `  <!-- Site B Node ${nodeNum} -->
      <g transform="translate(770, ${yOff})">
        <rect width="210" height="${nodeHeight}" rx="5" fill="url(#nodeGrad)" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
        <text x="12" y="16" fill="#fff" font-size="9" font-weight="700">${getNodeName(nodeNum)} (${model})</text>
        <text x="12" y="28" fill="var(--text-muted)" font-size="7">ONTAP Controller</text>
      </g>`;
      
      // Node Ports
      svg += drawCompactPort(780, yOff + 36, ports.cluster[0], "cluster");
      svg += drawCompactPort(801, yOff + 36, ports.cluster[1], "cluster");
      svg += drawCompactPort(822, yOff + 36, ports.storage[0], "storage");
      svg += drawCompactPort(843, yOff + 36, ports.storage[1], "storage");
      svg += drawCompactPort(864, yOff + 36, ports.management, "mgmt");
      svg += drawCompactPort(885, yOff + 36, ports.data[0], "data");
      svg += drawCompactPort(906, yOff + 36, ports.data[1], "data");
      svg += drawCompactPort(927, yOff + 36, isIp ? "e5a" : "fc1", "mc");
      svg += drawCompactPort(948, yOff + 36, isIp ? "e5b" : "fc2", "mc");

      // Draw expansion card ports
      sizingInfo.cards.forEach((card, c) => {
        const slotY = yOff + 54 + c * 18;
        svg += drawCompactPort(822, slotY, card.ports[0], "storage");
        svg += drawCompactPort(843, slotY, card.ports[1], "storage");
        svg += `  <text x="864" y="${slotY + 8}" fill="rgba(255,255,255,0.4)" font-size="5.5" font-weight="700">SLOT ${card.slot}</text>`;
      });
    }

    // Site B Switches
    const switchA2Label = isIp ? "MC-Sw A2" : "FC-Sw A2";
    const switchB2Label = isIp ? "MC-Sw B2" : "FC-Sw B2";

    if (nodesPerSite > 1) {
      svg += `  <!-- Site B Cluster Switches -->
      <g transform="translate(660, 65)">
        <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="0.75"/>
        <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Cluster Sw 3</text>
        <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Cluster Fabric A</text>
      </g>
      <g transform="translate(660, 105)">
        <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="0.75"/>
        <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Cluster Sw 4</text>
        <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Cluster Fabric B</text>
      </g>`;
    }

    svg += `  <!-- Site B MetroCluster Peering Switches -->
    <g transform="translate(560, 65)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(245, 158, 11, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">${switchA2Label}</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">${switchTypeSub} A</text>
    </g>
    <g transform="translate(560, 105)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(245, 158, 11, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">${switchB2Label}</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">${switchTypeSub} B</text>
    </g>
    
    <!-- Site B Mgmt & Data Switches -->
    <g transform="translate(660, 165)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(255,255,255,0.15)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Mgmt Sw B</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">1G RJ45 Fabric</text>
    </g>
    <g transform="translate(560, 165)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Data Sw A2</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Data Fabric A</text>
    </g>
    <g transform="translate(560, 205)">
      <rect width="80" height="28" rx="3" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="0.75"/>
      <text x="40" y="13" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">Data Sw B2</text>
      <text x="40" y="21" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6">Data Fabric B</text>
    </g>`;

    // Site B Shelves
    for (let s = 1; s <= shelfCount; s++) {
      const yOff = storageStartY + (s - 1) * 60;
      svg += `  <!-- Site B Shelf B${s} -->
      <g transform="translate(770, ${yOff})">
        <rect width="210" height="45" rx="3.5" fill="url(#shelfGrad)" stroke="rgba(16,185,129,0.15)" stroke-width="0.8"/>
        <text x="10" y="15" fill="#fff" font-size="8" font-weight="700">Shelf B${s} (${shelfType})</text>
        <text x="10" y="26" fill="var(--text-muted)" font-size="7">SAS/NVMe Multipath Loops</text>
      </g>`;
      svg += drawCompactPort(865, yOff + 30, "e0a", "storage");
      svg += drawCompactPort(885, yOff + 30, "e0b", "storage");
      svg += drawCompactPort(925, yOff + 30, "e0a", "storage");
      svg += drawCompactPort(945, yOff + 30, "e0b", "storage");
    }

    // --- INTER-SITE ISL CONNECTIONS ---
    svg += `  <!-- Inter-Site ISLs (Trunked lines across sites) -->
    <path d="M 440 79 L 560 79" class="animated-flow" stroke="url(#linkGrad)" stroke-width="2" fill="none"/>
    <path d="M 440 119 L 560 119" class="animated-flow" stroke="url(#linkGrad)" stroke-width="2" fill="none"/>
    <text x="500" y="72" text-anchor="middle" fill="#00f2fe" font-size="7" font-weight="bold">Fabric A ISLs</text>
    <text x="500" y="112" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="bold">Fabric B ISLs</text>`;

    // --- SITE A PATH LINES ---
    for (let idx = 0; idx < nodesPerSite; idx++) {
      const nodeNum = idx + 1;
      const yOff = startY + idx * nodeSpacing;
      
      // Cluster connections
      if (nodesPerSite > 1) {
        svg += `  <!-- Node ${nodeNum} Cluster e0a -> Switch 1 -->
        <path d="M 39 ${yOff + 36} C 39 ${yOff + 50}, 250 74, 260 74" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
        svg += `  <!-- Node ${nodeNum} Cluster e0b -> Switch 2 -->
        <path d="M 60 ${yOff + 36} C 60 ${yOff + 50}, 250 114, 260 114" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
      } else {
        // scale === 2 (Cluster ports to MC Switch A1/B1)
        svg += `  <!-- Node ${nodeNum} Cluster e0a -> MC Switch A1 -->
        <path d="M 39 ${yOff + 36} C 39 ${yOff + 50}, 350 74, 360 74" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
        svg += `  <!-- Node ${nodeNum} Cluster e0b -> MC Switch B1 -->
        <path d="M 60 ${yOff + 36} C 60 ${yOff + 50}, 350 114, 360 114" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
      }

      // MC peering connections
      svg += `  <!-- Node ${nodeNum} MC1 -> MC Switch A1 -->
      <path d="M 186 ${yOff + 36} C 186 ${yOff + 50}, 350 74, 360 74" stroke="#f59e0b" stroke-width="0.8" fill="none"/>`;
      svg += `  <!-- Node ${nodeNum} MC2 -> MC Switch B1 -->
      <path d="M 207 ${yOff + 36} C 207 ${yOff + 50}, 350 114, 360 114" stroke="#f59e0b" stroke-width="0.8" fill="none"/>`;

      // Management connection
      svg += `  <!-- Node ${nodeNum} Mgmt -> Mgmt Sw -->
      <path d="M 123 ${yOff + 36} C 123 ${yOff + 50}, 250 179, 260 179" stroke="#fff" stroke-width="0.8" fill="none" opacity="0.4"/>`;

      // Data connections
      svg += `  <!-- Node ${nodeNum} Data 1 -> Data Switch A1 -->
      <path d="M 144 ${yOff + 36} C 144 ${yOff + 50}, 350 179, 360 179" stroke="#a855f7" stroke-width="0.8" fill="none"/>`;
      svg += `  <!-- Node ${nodeNum} Data 2 -> Data Switch B1 -->
      <path d="M 165 ${yOff + 36} C 165 ${yOff + 50}, 350 219, 360 219" stroke="#a855f7" stroke-width="0.8" fill="none"/>`;
    }

    // --- SITE B PATH LINES ---
    for (let idx = 0; idx < nodesPerSite; idx++) {
      const nodeNum = halfNodes + idx + 1;
      const yOff = startY + idx * nodeSpacing;

      // Cluster connections
      if (nodesPerSite > 1) {
        svg += `  <!-- Node ${nodeNum} Cluster e0a -> Switch 3 -->
        <path d="M 789 ${yOff + 36} C 789 ${yOff + 50}, 670 74, 660 74" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
        svg += `  <!-- Node ${nodeNum} Cluster e0b -> Switch 4 -->
        <path d="M 810 ${yOff + 36} C 810 ${yOff + 50}, 670 114, 660 114" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
      } else {
        // scale === 2
        svg += `  <!-- Node ${nodeNum} Cluster e0a -> MC Switch A2 -->
        <path d="M 789 ${yOff + 36} C 789 ${yOff + 50}, 650 74, 640 74" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
        svg += `  <!-- Node ${nodeNum} Cluster e0b -> MC Switch B2 -->
        <path d="M 810 ${yOff + 36} C 810 ${yOff + 50}, 650 114, 640 114" stroke="#00f2fe" stroke-width="0.8" fill="none" opacity="0.85"/>`;
      }

      // MC peering connections
      svg += `  <!-- Node ${nodeNum} MC1 -> MC Switch A2 -->
      <path d="M 896 ${yOff + 36} C 896 ${yOff + 50}, 650 74, 640 74" stroke="#f59e0b" stroke-width="0.8" fill="none"/>`;
      svg += `  <!-- Node ${nodeNum} MC2 -> MC Switch B2 -->
      <path d="M 917 ${yOff + 36} C 917 ${yOff + 50}, 650 114, 640 114" stroke="#f59e0b" stroke-width="0.8" fill="none"/>`;

      // Management connection
      svg += `  <!-- Node ${nodeNum} Mgmt -> Mgmt Sw B -->
      <path d="M 833 ${yOff + 36} C 833 ${yOff + 50}, 670 179, 660 179" stroke="#fff" stroke-width="0.8" fill="none" opacity="0.4"/>`;

      // Data connections
      svg += `  <!-- Node ${nodeNum} Data 1 -> Data Switch A2 -->
      <path d="M 854 ${yOff + 36} C 854 ${yOff + 50}, 650 179, 640 179" stroke="#a855f7" stroke-width="0.8" fill="none"/>`;
      svg += `  <!-- Node ${nodeNum} Data 2 -> Data Switch B2 -->
      <path d="M 875 ${yOff + 36} C 875 ${yOff + 50}, 650 219, 640 219" stroke="#a855f7" stroke-width="0.8" fill="none"/>`;
    }

    // --- STORAGE LOCAL CABLING PATH LINES ---
    const isNvme = shelfType === "NS224";
    const stackSize = isNvme ? 2 : 4;
    
    for (let s = 1; s <= shelfCount; s++) {
      const yOff = storageStartY + (s - 1) * 60;
      const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
      let nodeA, nodeB;
      if (halfNodes === 1) {
        nodeA = 1;
        nodeB = 1;
      } else {
        nodeA = 2 * pairIdx - 1;
        nodeB = 2 * pairIdx;
      }
      
      const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
      const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
      
      if (nodeA <= nodesPerSite) {
        const yA = startY + (nodeA - 1) * nodeSpacing;
        const portAY = yA + 36 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <!-- Site A Shelf A${s} Multipath Node ${nodeA} -> A/B -->
          <path d="M 81 ${portAY} C 81 ${portAY + 14}, 124 ${yOff - 5}, 124 ${yOff + 30}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 102 ${portAY} C 102 ${portAY + 14}, 204 ${yOff - 5}, 204 ${yOff + 30}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 81 ${portAY} C 65 ${portAY + 14}, 100 ${yOff - 10}, 124 ${yOff + 30}" stroke="#10b981" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 102 ${portAY} C 120 ${portAY + 14}, 220 ${yOff - 10}, 204 ${yOff + 30}" stroke="#059669" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
      
      if (nodeB !== nodeA && nodeB <= nodesPerSite) {
        const yB = startY + (nodeB - 1) * nodeSpacing;
        const portBY = yB + 36 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <!-- Site A Shelf A${s} Multipath Node ${nodeB} -> A/B -->
          <path d="M 81 ${portBY} C 81 ${portBY + 14}, 184 ${yOff - 5}, 184 ${yOff + 30}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 102 ${portBY} C 102 ${portBY + 14}, 144 ${yOff - 5}, 144 ${yOff + 30}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 81 ${portBY} C 65 ${portBY + 14}, 160 ${yOff - 10}, 184 ${yOff + 30}" stroke="#10b981" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 102 ${portBY} C 120 ${portBY + 14}, 120 ${yOff - 10}, 144 ${yOff + 30}" stroke="#059669" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
    }

    for (let s = 1; s <= shelfCount; s++) {
      const yOff = storageStartY + (s - 1) * 60;
      const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
      let nodeA, nodeB;
      if (halfNodes === 1) {
        nodeA = 2;
        nodeB = 2;
      } else {
        nodeA = halfNodes + 2 * pairIdx - 1;
        nodeB = halfNodes + 2 * pairIdx;
      }
      
      const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
      const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
      
      if (nodeA > halfNodes && nodeA <= nodeCount) {
        const yA = startY + (nodeA - halfNodes - 1) * nodeSpacing;
        const portAY = yA + 36 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <!-- Site B Shelf B${s} Multipath Node ${nodeA} -> A/B -->
          <path d="M 831 ${portAY} C 831 ${portAY + 14}, 874 ${yOff - 5}, 874 ${yOff + 30}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 852 ${portAY} C 852 ${portAY + 14}, 954 ${yOff - 5}, 954 ${yOff + 30}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 831 ${portAY} C 815 ${portAY + 14}, 850 ${yOff - 10}, 874 ${yOff + 30}" stroke="#10b981" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 852 ${portAY} C 870 ${portAY + 14}, 970 ${yOff - 10}, 954 ${yOff + 30}" stroke="#059669" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
      
      if (nodeB !== nodeA && nodeB > halfNodes && nodeB <= nodeCount) {
        const yB = startY + (nodeB - halfNodes - 1) * nodeSpacing;
        const portBY = yB + 36 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <!-- Site B Shelf B${s} Multipath Node ${nodeB} -> A/B -->
          <path d="M 831 ${portBY} C 831 ${portBY + 14}, 934 ${yOff - 5}, 934 ${yOff + 30}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 852 ${portBY} C 852 ${portBY + 14}, 894 ${yOff - 5}, 894 ${yOff + 30}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 831 ${portBY} C 815 ${portBY + 14}, 910 ${yOff - 10}, 934 ${yOff + 30}" stroke="#10b981" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 852 ${portBY} C 870 ${portBY + 14}, 870 ${yOff - 10}, 894 ${yOff + 30}" stroke="#059669" stroke-width="1" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
    }

    // Site C Mediator
    if (mcc.mediator !== "none") {
      svg += `  <!-- Site C Mediator -->
      <g transform="translate(460, 10)">
        <rect width="80" height="30" rx="3.5" fill="rgba(0,0,0,0.5)" stroke="rgba(0,242,254,0.3)" stroke-width="0.75"/>
        <text x="40" y="11" text-anchor="middle" fill="#fff" font-size="7" font-weight="bold">Site C Mediator</text>
        <text x="40" y="21" text-anchor="middle" fill="#00f2fe" font-size="6.5">${mediatorType}</text>
      </g>
      <path d="M 460 25 C 330 25, 120 38, 120 70" class="heartbeat-flow" stroke="rgba(0,242,254,0.4)" stroke-width="0.8" fill="none"/>
      <path d="M 540 25 C 670 25, 880 38, 880 70" class="heartbeat-flow" stroke="rgba(0,242,254,0.4)" stroke-width="0.8" fill="none"/>`;
    }

    svg += `</svg>`;
    return svg;
  }

  // Set SVG dimensions dynamically for ONTAP
  const activeSvgNodes = Math.min(4, nodeCount);
  const activeSvgShelves = shelfCount;
  const numPairs = Math.max(1, nodeCount / 2);
  const shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
  const sizingInfo = getExpansionCardsAndPorts(model, shelfType, shelvesPerPair);
  
  const startY = (clusterCabling === "switched" || nodeCount > 2) ? 100 : 40;
  const shelvesY = startY + activeSvgNodes * 80 + (nodeCount > 4 ? 20 : 10);
  
  const svgWidth = 800;
  const svgHeight = shelvesY + activeSvgShelves * 95 + 15;
  let svg = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent; font-family:inherit;">`;

  svg += `  <defs>
    <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(30, 41, 59, 0.95)"/>
      <stop offset="100%" stop-color="rgba(15, 23, 42, 0.95)"/>
    </linearGradient>
    <linearGradient id="shelfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(16, 185, 129, 0.15)"/>
      <stop offset="100%" stop-color="rgba(15, 23, 42, 0.6)"/>
    </linearGradient>
    <linearGradient id="switchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(0, 242, 254, 0.2)"/>
      <stop offset="100%" stop-color="rgba(0, 242, 254, 0.05)"/>
    </linearGradient>
  </defs>`;

  const isDirect = (clusterCabling === "direct" && nodeCount === 2);
  const nodesHeightVal = activeSvgNodes * 80 - 15;
  const mgmtY = startY + (nodesHeightVal / 2) - 25;
  svg += `  <!-- Mgmt Switch -->
  <g transform="translate(20, ${mgmtY})">
    <rect width="130" height="50" rx="6" fill="url(#switchGrad)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <text x="65" y="20" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">MGMT Switch</text>
    <text x="65" y="35" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">1G/10G RJ45 Fabric</text>
  </g>`;

  let dataSwitchLabel = proto.startsWith("fc") || proto.includes("fcoe") ? "FC Fabric SAN" : "Data Switch";
  let dataSpeed = state.network.portSpeed || "25";
  const dataAY = startY + (nodesHeightVal / 2) - 55;
  const dataBY = startY + (nodesHeightVal / 2) + 5;
  svg += `  <!-- Data Switch A -->
  <g transform="translate(650, ${dataAY})">
    <rect width="130" height="50" rx="6" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1"/>
    <text x="65" y="20" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">${dataSwitchLabel} A</text>
    <text x="65" y="35" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">${dataSpeed}G Speed Fabric</text>
  </g>
  <!-- Data Switch B -->
  <g transform="translate(650, ${dataBY})">
    <rect width="130" height="50" rx="6" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1"/>
    <text x="65" y="20" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">${dataSwitchLabel} B</text>
    <text x="65" y="35" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">${dataSpeed}G Speed Fabric</text>
  </g>`;

  let switchName = switchModel;
  if (switchModel === "Nexus3132QV") switchName = "Cisco Nexus 3132Q-V";
  else if (switchModel === "SN2100") switchName = "NVIDIA SN2100";
  else if (switchModel === "BES53248") switchName = "NetApp BES-53248";

  if (clusterCabling === "switched" || nodeCount > 2) {
    svg += `  <!-- Cluster Switch 1 -->
    <g transform="translate(240, 20)">
      <rect width="150" height="40" rx="4" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1"/>
      <text x="75" y="16" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Cluster Switch 1</text>
      <text x="75" y="28" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">${switchName}</text>
    </g>
    <!-- Cluster Switch 2 -->
    <g transform="translate(410, 20)">
      <rect width="150" height="40" rx="4" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1"/>
      <text x="75" y="16" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Cluster Switch 2</text>
      <text x="75" y="28" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="8">${switchName}</text>
    </g>`;
  }

  function drawPort(x, y, label, type) {
    let stroke = "rgba(255,255,255,0.3)";
    let fill = "rgba(255,255,255,0.05)";
    let text = "#94a3b8";
    if (type === "cluster") { stroke = "rgba(0,242,254,0.6)"; fill = "rgba(0,242,254,0.1)"; text = "#00f2fe"; }
    else if (type === "storage") { stroke = "rgba(16,185,129,0.6)"; fill = "rgba(16,185,129,0.1)"; text = "#10b981"; }
    else if (type === "data") { stroke = "rgba(168,85,247,0.6)"; fill = "rgba(168,85,247,0.1)"; text = "#a855f7"; }
    else if (type === "mgmt") { stroke = "rgba(255,255,255,0.6)"; fill = "rgba(255,255,255,0.1)"; text = "#fff"; }

    return `
      <rect x="${x}" y="${y}" width="26" height="15" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
      <text x="${x + 13}" y="${y + 11}" text-anchor="middle" fill="${text}" font-size="7" font-weight="700" font-family="monospace">${label}</text>
    `;
  }

  // Draw first 4 nodes max in SVG to avoid layout bloat, note the rest
  for (let i = 0; i < activeSvgNodes; i++) {
    const yOff = startY + i * 80;
    svg += `  <!-- Node ${i+1} Controller -->
    <g transform="translate(190, ${yOff})">
      <rect width="420" height="65" rx="6" fill="url(#nodeGrad)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
      <text x="15" y="22" fill="#fff" font-size="10" font-weight="700">${getNodeName(i+1)} (${model})</text>
      <text x="35" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">CLUSTER</text>
      <text x="105" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">STORAGE</text>
      <text x="175" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">MGMT</text>
      <text x="225" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">DATA/FABRIC</text>
    </g>`;

    svg += drawPort(205, yOff + 42, ports.cluster[0], "cluster");
    svg += drawPort(235, yOff + 42, ports.cluster[1], "cluster");
    svg += drawPort(285, yOff + 42, ports.storage[0], "storage");
    svg += drawPort(315, yOff + 42, ports.storage[1], "storage");
    svg += drawPort(365, yOff + 42, ports.management, "mgmt");
    svg += drawPort(415, yOff + 42, ports.data[0], "data");
    svg += drawPort(445, yOff + 42, ports.data[1], "data");

    // Draw expansion card ports horizontally if any
    sizingInfo.cards.forEach((card, cIdx) => {
      const cardX1 = 485 + cIdx * 65;
      const cardX2 = 515 + cIdx * 65;
      svg += drawPort(cardX1, yOff + 42, card.ports[0], "storage");
      svg += drawPort(cardX2, yOff + 42, card.ports[1], "storage");
      svg += `<text x="${cardX1 + 15}" y="${yOff + 33}" fill="rgba(255,255,255,0.4)" font-size="6" font-weight="700">SLOT ${card.slot}</text>`;
    });

    // Cables from cluster ports
    if (isDirect) {
      if (i === 0) {
        svg += `  <path d="M 218 ${yOff + 57} L 218 ${yOff + 80 + 42}" stroke="#00f2fe" stroke-width="2.5" fill="none" opacity="0.8"/>`;
        svg += `  <path d="M 248 ${yOff + 57} L 248 ${yOff + 80 + 42}" stroke="#00f2fe" stroke-width="2.5" fill="none" opacity="0.8"/>`;
      }
    } else {
      svg += `  <path d="M 218 ${yOff + 42} C 218 ${yOff}, 260 50, 315 60" stroke="#00f2fe" stroke-width="2" fill="none" opacity="0.8"/>`;
      svg += `  <path d="M 248 ${yOff + 42} C 248 ${yOff}, 380 50, 485 60" stroke="#00f2fe" stroke-width="2" fill="none" opacity="0.8"/>`;
    }

    // Cables to management switch
    svg += `  <path d="M 378 ${yOff + 42} C 378 ${yOff + 70}, 160 ${mgmtY + 25}, 150 ${mgmtY + 25}" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="3,3" fill="none" opacity="0.7"/>`;

    // Cables to data switches
    svg += `  <path d="M 428 ${yOff + 42} C 428 ${yOff - 10}, 600 ${dataAY + 25}, 650 ${dataAY + 25}" stroke="#a855f7" stroke-width="2" fill="none" opacity="0.8"/>`;
    svg += `  <path d="M 458 ${yOff + 42} C 458 ${yOff + 70}, 600 ${dataBY + 25}, 650 ${dataBY + 25}" stroke="#a855f7" stroke-width="2" fill="none" opacity="0.8"/>`;
  }

  if (nodeCount > 4) {
    svg += `  <!-- Nodes note -->
    <g transform="translate(190, ${startY + activeSvgNodes * 80})">
      <text x="210" y="10" fill="rgba(255,255,255,0.4)" font-size="8">Note: Displaying first 4 nodes of the configured ${nodeCount}-node cluster.</text>
    </g>`;
  }

  // Draw shelves
  for (let s = 1; s <= activeSvgShelves; s++) {
    const yOff = shelvesY + (s - 1) * 95;
    svg += `  <!-- Shelf ${s} -->
    <g transform="translate(190, ${yOff})">
      <rect width="420" height="60" rx="4" fill="url(#shelfGrad)" stroke="rgba(16,185,129,0.2)" stroke-width="1"/>
      <text x="15" y="20" fill="#fff" font-size="9" font-weight="700">Shelf ${s} (${shelfType})</text>
      <text x="80" y="32" fill="rgba(255,255,255,0.3)" font-size="7" font-weight="700">NSM A (Ports A/B)</text>
      <text x="290" y="32" fill="rgba(255,255,255,0.3)" font-size="7" font-weight="700">NSM B (Ports A/B)</text>
    </g>`;
    
    svg += drawPort(285, yOff + 40, "e0a", "storage");
    svg += drawPort(315, yOff + 40, "e0b", "storage");
    svg += drawPort(495, yOff + 40, "e0a", "storage");
    svg += drawPort(525, yOff + 40, "e0b", "storage");

    // Connect node storage ports of HA pairs to shelf ports
    // Shelves are distributed across active HA pairs dynamically
    const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
    const nodeA = 2 * pairIdx - 1;
    const nodeB = 2 * pairIdx;
    
    const isNvme = shelfType === "NS224";
    const stackSize = isNvme ? 2 : 4;
    const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
    const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
    
    let pAx1, pAx2;
    if (stackIdx === 0) {
      pAx1 = 298;
      pAx2 = 328;
    } else {
      pAx1 = 485 + (stackIdx - 1) * 65 + 13;
      pAx2 = 485 + (stackIdx - 1) * 65 + 43;
    }
    
    if (nodeA <= activeSvgNodes) {
      const yA = startY + (nodeA - 1) * 80;
      if (s % 2 !== 0) {
        // Odd shelf - Solid connection paths
        svg += `  <path d="M ${pAx1} ${yA + 57} L 298 ${yOff + 40}" stroke="#10b981" stroke-width="2" fill="none" opacity="0.8"/>`;
        svg += `  <path d="M ${pAx2} ${yA + 57} C ${pAx2} ${yA + 80}, 538 ${yA + 80}, 538 ${yOff + 40}" stroke="#059669" stroke-width="2" fill="none" opacity="0.8"/>`;
      } else {
        // Even shelf - Dashed connection paths
        svg += `  <path d="M ${pAx1} ${yA + 57} C ${pAx1 - 28} ${yA + 80}, 270 ${yOff - 20}, 298 ${yOff + 40}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        svg += `  <path d="M ${pAx2} ${yA + 57} C ${pAx2 + 12} ${yA + 80}, 550 ${yOff - 20}, 538 ${yOff + 40}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
      }
    }
    
    if (nodeB <= activeSvgNodes) {
      const yB = startY + (nodeB - 1) * 80;
      if (s % 2 !== 0) {
        // Odd shelf - Solid connection paths
        svg += `  <path d="M ${pAx1} ${yB + 57} C ${pAx1} ${yB + 80}, 508 ${yB + 80}, 508 ${yOff + 40}" stroke="#10b981" stroke-width="2" fill="none" opacity="0.8"/>`;
        svg += `  <path d="M ${pAx2} ${yB + 57} L 328 ${yOff + 40}" stroke="#059669" stroke-width="2" fill="none" opacity="0.8"/>`;
      } else {
        // Even shelf - Dashed connection paths
        svg += `  <path d="M ${pAx1} ${yB + 57} C ${pAx1 - 28} ${yB + 80}, 480 ${yOff - 20}, 508 ${yOff + 40}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        svg += `  <path d="M ${pAx2} ${yB + 57} C ${pAx2 + 12} ${yB + 80}, 340 ${yOff - 20}, 328 ${yOff + 40}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

function generateSvgStorageOnlyCabling() {
  const model = state.sizing.controller;
  const nodeCount = parseInt(state.sizing.nodeCount) || 2;
  const shelfType = state.sizing.shelfType;
  const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
  const ports = getControllerPorts(model);

  const switchAName = (state.customSwitchNames && state.customSwitchNames.switchA) || "Switch-A";
  const switchBName = (state.customSwitchNames && state.customSwitchNames.switchB) || "Switch-B";
  const getNodeName = (x) => state.customNodeNames[x - 1] || `Node ${x}`;

  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    const mcc = state.metrocluster;
    const halfNodes = nodeCount / 2;
    const nodesPerSite = halfNodes;

    const numPairs = Math.max(1, halfNodes / 2);
    const shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
    const sizingInfo = getExpansionCardsAndPorts(model, shelfType, shelvesPerPair);
    const cardsNeeded = sizingInfo.cards.length;

    const nodeHeight = 55 + cardsNeeded * 18;
    const nodeSpacing = 80 + cardsNeeded * 18;

    const startY = 20;
    const shelvesY = startY + nodesPerSite * nodeSpacing + 10;
    
    const svgWidth = 960;
    const svgHeight = shelvesY + shelfCount * 95 + 15;
    
    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent; font-family:inherit;">`;
    svg += `  <defs>
      <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(30, 41, 59, 0.95)"/>
        <stop offset="100%" stop-color="rgba(15, 23, 42, 0.95)"/>
      </linearGradient>
      <linearGradient id="shelfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(16, 185, 129, 0.15)"/>
        <stop offset="100%" stop-color="rgba(15, 23, 42, 0.6)"/>
      </linearGradient>
    </defs>`;

    function drawPort(x, y, label) {
      return `
        <rect x="${x}" y="${y}" width="24" height="14" rx="2" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.6)" stroke-width="0.75"/>
        <text x="${x + 12}" y="${y + 10}" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700" font-family="monospace">${label}</text>
      `;
    }

    svg += `<text x="215" y="15" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Site A (Local Site) Storage</text>`;
    svg += `<text x="745" y="15" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Site B (Remote DR Site) Storage</text>`;

    // --- SITE A ---
    // Draw Site A Nodes
    for (let i = 0; i < nodesPerSite; i++) {
      const yOff = startY + i * nodeSpacing;
      svg += `  <!-- Site A Node ${i+1} -->
      <g transform="translate(110, ${yOff})">
        <rect width="210" height="${nodeHeight}" rx="5" fill="url(#nodeGrad)" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
        <text x="12" y="18" fill="#fff" font-size="9" font-weight="700">${getNodeName(i+1)} (${model})</text>
        <text x="12" y="28" fill="var(--text-muted)" font-size="7.5">Storage Ports Only</text>
      </g>`;
      
      svg += drawPort(240, yOff + 32, ports.storage[0]);
      svg += drawPort(275, yOff + 32, ports.storage[1]);

      // Expansion card ports stacked vertically
      sizingInfo.cards.forEach((card, c) => {
        const slotY = yOff + 50 + c * 18;
        svg += drawPort(240, slotY, card.ports[0]);
        svg += drawPort(275, slotY, card.ports[1]);
        svg += `<text x="140" y="${slotY + 10}" fill="rgba(255,255,255,0.4)" font-size="6" font-weight="700">SLOT ${card.slot}</text>`;
      });
    }

    // Draw Site A Shelves
    for (let s = 1; s <= shelfCount; s++) {
      const yOff = shelvesY + (s - 1) * 95;
      svg += `  <!-- Site A Shelf A${s} -->
      <g transform="translate(110, ${yOff})">
        <rect width="210" height="60" rx="4" fill="url(#shelfGrad)" stroke="rgba(16,185,129,0.2)" stroke-width="1"/>
        <text x="12" y="18" fill="#fff" font-size="8.5" font-weight="700">Shelf A${s} (${shelfType})</text>
        <text x="50" y="32" fill="rgba(255,255,255,0.3)" font-size="6.5" font-weight="700">NSM A</text>
        <text x="150" y="32" fill="rgba(255,255,255,0.3)" font-size="6.5" font-weight="700">NSM B</text>
      </g>`;
      
      svg += drawPort(145, yOff + 35, "e0a");
      svg += drawPort(175, yOff + 35, "e0b");
      svg += drawPort(245, yOff + 35, "e0a");
      svg += drawPort(275, yOff + 35, "e0b");

      // Connect Site A Nodes to Site A Shelves
      const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
      const isNvme = shelfType === "NS224";
      const stackSize = isNvme ? 2 : 4;
      const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
      const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
      
      let nodeA, nodeB;
      if (halfNodes === 1) {
        nodeA = 1;
        nodeB = 1;
      } else {
        nodeA = 2 * pairIdx - 1;
        nodeB = 2 * pairIdx;
      }

      if (nodeA <= nodesPerSite) {
        const yA = startY + (nodeA - 1) * nodeSpacing;
        const portAY = yA + 38 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <path d="M 252 ${portAY} C 252 ${portAY + 14}, 157 ${yOff - 5}, 157 ${yOff + 35}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 287 ${portAY} C 287 ${portAY + 14}, 287 ${portAY + 14}, 287 ${yOff + 35}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 252 ${portAY} C 240 ${portAY + 14}, 130 ${yOff - 10}, 157 ${yOff + 35}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 287 ${portAY} C 300 ${portAY + 14}, 300 ${yOff - 10}, 287 ${yOff + 35}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
      if (nodeB !== nodeA && nodeB <= nodesPerSite) {
        const yB = startY + (nodeB - 1) * nodeSpacing;
        const portBY = yB + 38 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <path d="M 252 ${portBY} C 252 ${portBY + 14}, 257 ${portBY + 14}, 257 ${yOff + 35}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 287 ${portBY} C 287 ${portBY + 14}, 187 ${portBY + 14}, 187 ${yOff + 35}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 252 ${portBY} C 240 ${portBY + 14}, 240 ${yOff - 10}, 257 ${yOff + 35}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 287 ${portBY} C 300 ${portBY + 14}, 170 ${yOff - 10}, 187 ${yOff + 35}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
    }

    // --- SITE B ---
    // Draw Site B Nodes
    for (let i = 0; i < nodesPerSite; i++) {
      const yOff = startY + i * nodeSpacing;
      const nodeNum = halfNodes + i + 1;
      svg += `  <!-- Site B Node ${nodeNum} -->
      <g transform="translate(640, ${yOff})">
        <rect width="210" height="${nodeHeight}" rx="5" fill="url(#nodeGrad)" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>
        <text x="12" y="18" fill="#fff" font-size="9" font-weight="700">${getNodeName(nodeNum)} (${model})</text>
        <text x="12" y="28" fill="var(--text-muted)" font-size="7.5">Storage Ports Only</text>
      </g>`;
      
      svg += drawPort(770, yOff + 32, ports.storage[0]);
      svg += drawPort(805, yOff + 32, ports.storage[1]);

      // Expansion card ports stacked vertically
      sizingInfo.cards.forEach((card, c) => {
        const slotY = yOff + 50 + c * 18;
        svg += drawPort(770, slotY, card.ports[0]);
        svg += drawPort(805, slotY, card.ports[1]);
        svg += `<text x="670" y="${slotY + 10}" fill="rgba(255,255,255,0.4)" font-size="6" font-weight="700">SLOT ${card.slot}</text>`;
      });
    }

    // Draw Site B Shelves
    for (let s = 1; s <= shelfCount; s++) {
      const yOff = shelvesY + (s - 1) * 95;
      svg += `  <!-- Site B Shelf B${s} -->
      <g transform="translate(640, ${yOff})">
        <rect width="210" height="60" rx="4" fill="url(#shelfGrad)" stroke="rgba(16,185,129,0.2)" stroke-width="1"/>
        <text x="12" y="18" fill="#fff" font-size="8.5" font-weight="700">Shelf B${s} (${shelfType})</text>
        <text x="50" y="32" fill="rgba(255,255,255,0.3)" font-size="6.5" font-weight="700">NSM A</text>
        <text x="150" y="32" fill="rgba(255,255,255,0.3)" font-size="6.5" font-weight="700">NSM B</text>
      </g>`;
      
      svg += drawPort(675, yOff + 35, "e0a");
      svg += drawPort(705, yOff + 35, "e0b");
      svg += drawPort(775, yOff + 35, "e0a");
      svg += drawPort(805, yOff + 35, "e0b");

      // Connect Site B Nodes to Site B Shelves
      const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
      const isNvme = shelfType === "NS224";
      const stackSize = isNvme ? 2 : 4;
      const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
      const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
      
      let nodeA, nodeB;
      if (halfNodes === 1) {
        nodeA = 2;
        nodeB = 2;
      } else {
        nodeA = halfNodes + 2 * pairIdx - 1;
        nodeB = halfNodes + 2 * pairIdx;
      }

      if (nodeA > halfNodes && nodeA <= nodeCount) {
        const yA = startY + (nodeA - halfNodes - 1) * nodeSpacing;
        const portAY = yA + 38 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <path d="M 782 ${portAY} C 782 ${portAY + 14}, 687 ${portAY + 14}, 687 ${yOff + 35}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 817 ${portAY} C 817 ${portAY + 14}, 817 ${portAY + 14}, 817 ${yOff + 35}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 782 ${portAY} C 770 ${portAY + 14}, 660 ${yOff - 10}, 687 ${yOff + 35}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 817 ${portAY} C 830 ${portAY + 14}, 830 ${yOff - 10}, 817 ${yOff + 35}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
      if (nodeB !== nodeA && nodeB > halfNodes && nodeB <= nodeCount) {
        const yB = startY + (nodeB - halfNodes - 1) * nodeSpacing;
        const portBY = yB + 38 + stackIdx * 18;
        if (s % 2 !== 0) {
          svg += `  <path d="M 782 ${portBY} C 782 ${portBY + 14}, 787 ${portBY + 14}, 787 ${yOff + 35}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.8"/>`;
          svg += `  <path d="M 817 ${portBY} C 817 ${portBY + 14}, 717 ${portBY + 14}, 717 ${yOff + 35}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.8"/>`;
        } else {
          svg += `  <path d="M 782 ${portBY} C 770 ${portBY + 14}, 770 ${yOff - 10}, 787 ${yOff + 35}" stroke="#10b981" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
          svg += `  <path d="M 817 ${portBY} C 830 ${portBY + 14}, 700 ${yOff - 10}, 717 ${yOff + 35}" stroke="#059669" stroke-width="1.2" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        }
      }
    }

    svg += `</svg>`;
    return svg;
  }

  const activeSvgNodes = Math.min(4, nodeCount);
  const activeSvgShelves = shelfCount;
  
  const numPairs = Math.max(1, nodeCount / 2);
  const shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
  const sizingInfo = getExpansionCardsAndPorts(model, shelfType, shelvesPerPair);
  
  const startY = 20;
  const nodeSpacing = 80;
  const shelvesY = startY + activeSvgNodes * nodeSpacing + 10;
  
  const svgWidth = 800;
  const svgHeight = shelvesY + activeSvgShelves * 95 + 15;
  
  let svg = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent; font-family:inherit;">`;

  svg += `  <defs>
    <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(30, 41, 59, 0.95)"/>
      <stop offset="100%" stop-color="rgba(15, 23, 42, 0.95)"/>
    </linearGradient>
    <linearGradient id="shelfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(16, 185, 129, 0.15)"/>
      <stop offset="100%" stop-color="rgba(15, 23, 42, 0.6)"/>
    </linearGradient>
  </defs>`;

  function drawPort(x, y, label) {
    return `
      <rect x="${x}" y="${y}" width="26" height="15" rx="2" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.6)" stroke-width="1"/>
      <text x="${x + 13}" y="${y + 11}" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700" font-family="monospace">${label}</text>
    `;
  }

  // Draw Nodes
  for (let i = 0; i < activeSvgNodes; i++) {
    const yOff = startY + i * 80;
    svg += `  <!-- Node ${i+1} Controller -->
    <g transform="translate(190, ${yOff})">
      <rect width="420" height="65" rx="6" fill="url(#nodeGrad)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
      <text x="15" y="22" fill="#fff" font-size="10" font-weight="700">${getNodeName(i+1)} (${model})</text>
      <text x="35" y="42" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="700">STORAGE PORTS ONLY</text>
    </g>`;

    svg += drawPort(395, yOff + 35, ports.storage[0]);
    svg += drawPort(435, yOff + 35, ports.storage[1]);

    // Draw expansion card ports horizontally if any
    sizingInfo.cards.forEach((card, cIdx) => {
      const cardX1 = 485 + cIdx * 65;
      const cardX2 = 515 + cIdx * 65;
      svg += drawPort(cardX1, yOff + 35, card.ports[0]);
      svg += drawPort(cardX2, yOff + 35, card.ports[1]);
      svg += `<text x="${cardX1 + 15}" y="${yOff + 28}" fill="rgba(255,255,255,0.4)" font-size="6" font-weight="700">SLOT ${card.slot}</text>`;
    });
  }

  // Draw shelves
  for (let s = 1; s <= activeSvgShelves; s++) {
    const yOff = shelvesY + (s - 1) * 95;
    svg += `  <!-- Shelf ${s} -->
    <g transform="translate(190, ${yOff})">
      <rect width="420" height="60" rx="4" fill="url(#shelfGrad)" stroke="rgba(16,185,129,0.2)" stroke-width="1"/>
      <text x="15" y="20" fill="#fff" font-size="9" font-weight="700">Shelf ${s} (${shelfType})</text>
      <text x="80" y="32" fill="rgba(255,255,255,0.3)" font-size="7" font-weight="700">NSM A (Ports A/B)</text>
      <text x="290" y="32" fill="rgba(255,255,255,0.3)" font-size="7" font-weight="700">NSM B (Ports A/B)</text>
    </g>`;
    
    svg += drawPort(285, yOff + 40, "e0a");
    svg += drawPort(315, yOff + 40, "e0b");
    svg += drawPort(495, yOff + 40, "e0a");
    svg += drawPort(525, yOff + 40, "e0b");

    // Connect node storage ports of HA pairs to shelf ports
    const pairIdx = Math.floor((s - 1) / shelvesPerPair) + 1;
    const nodeA = 2 * pairIdx - 1;
    const nodeB = 2 * pairIdx;
    
    const isNvme = shelfType === "NS224";
    const stackSize = isNvme ? 2 : 4;
    const shelfIdxWithinPair = (s - 1) % shelvesPerPair;
    const stackIdx = Math.floor(shelfIdxWithinPair / stackSize);
    
    if (nodeA <= activeSvgNodes) {
      const yA = startY + (nodeA - 1) * nodeSpacing;
      const portAY = yA + 42.5 + stackIdx * 18;
      if (s % 2 !== 0) {
        // Odd shelf - Solid connection paths
        svg += `  <path d="M 408 ${portAY} C 408 ${portAY + 15}, 298 ${portAY + 15}, 298 ${yOff + 40}" stroke="#10b981" stroke-width="2" fill="none" opacity="0.8"/>`;
        svg += `  <path d="M 448 ${portAY} C 448 ${portAY + 15}, 538 ${portAY + 15}, 538 ${yOff + 40}" stroke="#059669" stroke-width="2" fill="none" opacity="0.8"/>`;
      } else {
        // Even shelf - Dashed connection paths
        svg += `  <path d="M 408 ${portAY} C 380 ${portAY + 15}, 270 ${yOff - 20}, 298 ${yOff + 40}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        svg += `  <path d="M 448 ${portAY} C 470 ${portAY + 15}, 550 ${yOff - 20}, 538 ${yOff + 40}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
      }
    }
    
    if (nodeB <= activeSvgNodes) {
      const yB = startY + (nodeB - 1) * nodeSpacing;
      const portBY = yB + 42.5 + stackIdx * 18;
      if (s % 2 !== 0) {
        // Odd shelf - Solid connection paths
        svg += `  <path d="M 408 ${portBY} C 408 ${portBY + 15}, 508 ${portBY + 15}, 508 ${yOff + 40}" stroke="#10b981" stroke-width="2" fill="none" opacity="0.8"/>`;
        svg += `  <path d="M 448 ${portBY} C 448 ${portBY + 15}, 328 ${portBY + 15}, 328 ${yOff + 40}" stroke="#059669" stroke-width="2" fill="none" opacity="0.8"/>`;
      } else {
        // Even shelf - Dashed connection paths
        svg += `  <path d="M 408 ${portBY} C 380 ${portBY + 15}, 480 ${yOff - 20}, 508 ${yOff + 40}" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
        svg += `  <path d="M 448 ${portBY} C 470 ${portBY + 15}, 340 ${yOff - 20}, 328 ${yOff + 40}" stroke="#059669" stroke-width="1.5" fill="none" opacity="0.75" stroke-dasharray="2,2"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

function generateSvgTopology() {
  const hypervisor = state.workload ? state.workload.hypervisor : "none";
  const db = state.workload ? state.workload.db : "none";
  const switchBrand = state.network ? state.network.switchBrand : "none";
  const proto = state.protocol || "nfs";
  const isSg = state.platform === "storagegrid";
  const hasFabricPool = state.ontapFabricPool && state.ontapFabricPool.enabled;

  const switchAName = (state.customSwitchNames && state.customSwitchNames.switchA) || "Switch-A";
  const switchBName = (state.customSwitchNames && state.customSwitchNames.switchB) || "Switch-B";
  const getNodeName = (x) => state.customNodeNames[x - 1] || `Node ${x}`;

  if (state.platform === "ontap" && state.metrocluster && state.metrocluster.enabled) {
    const mcc = state.metrocluster;
    const isIp = mcc.type === "ip";
    const mediatorType = mcc.mediator === "mediator" ? "ONTAP Mediator" : (mcc.mediator === "tiebreaker" ? "Tiebreaker Node" : "None");
    const shelfType = state.sizing.shelfType;
    const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
    
    const scale = parseInt(mcc.scale) || 4;
    const halfNodes = scale / 2;
    const nodesPerSite = halfNodes;
    
    // Dynamic site box height
    const siteBoxHeight = nodesPerSite === 4 ? 420 : 280;
    
    // Dynamic switch local Y offsets
    const swAY = nodesPerSite === 4 ? 67 : 35;
    const swBY = nodesPerSite === 4 ? 165 : 100;
    
    // Dynamic storage loop local Y offset
    const storageLoopY = nodesPerSite === 4 ? 310 : 170;
    
    const boxWidth = 800;
    const siteBoxBottom = 80 + siteBoxHeight;
    const cloudTierY = siteBoxBottom + 20;
    const boxHeight = hasFabricPool ? (cloudTierY + 100) : (siteBoxBottom + 40);
    
    let svg = '<svg width="100%" height="100%" viewBox="0 0 ' + boxWidth + ' ' + boxHeight + '" xmlns="http://www.w3.org/2000/svg" style="background:transparent; font-family:inherit;">';
    
    svg += '  <defs>';
    svg += '    <linearGradient id="hostGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
    svg += '      <stop offset="0%" stop-color="rgba(168, 85, 247, 0.4)"/>';
    svg += '      <stop offset="100%" stop-color="rgba(168, 85, 247, 0.05)"/>';
    svg += '    </linearGradient>';
    svg += '    <linearGradient id="switchGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
    svg += '      <stop offset="0%" stop-color="rgba(0, 242, 254, 0.4)"/>';
    svg += '      <stop offset="100%" stop-color="rgba(0, 242, 254, 0.05)"/>';
    svg += '    </linearGradient>';
    svg += '    <linearGradient id="storageGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
    svg += '      <stop offset="0%" stop-color="rgba(16, 185, 129, 0.4)"/>';
    svg += '      <stop offset="100%" stop-color="rgba(16, 185, 129, 0.05)"/>';
    svg += '    </linearGradient>';
    svg += '    <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">';
    svg += '      <stop offset="0%" stop-color="rgba(0, 242, 254, 0.8)"/>';
    svg += '      <stop offset="100%" stop-color="rgba(168, 85, 247, 0.8)"/>';
    svg += '    </linearGradient>';
    svg += '    <style>';
    svg += '      @keyframes flow { to { stroke-dashoffset: -20; } }';
    svg += '      .animated-flow { stroke-dasharray: 6, 4; animation: flow 1.2s linear infinite; }';
    svg += '      .heartbeat-flow { stroke-dasharray: 2; animation: flow 1.5s linear infinite; }';
    svg += '    </style>';
    svg += '  </defs>';

    // 1. Site A (Left Box)
    svg += '  <g transform="translate(20, 80)">';
    svg += '    <rect width="240" height="' + siteBoxHeight + '" rx="8" fill="url(#storageGrad)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="120" y="22" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="700">Site A (Local Cluster)</text>';
    
    // Draw Site A Nodes
    for (let i = 0; i < nodesPerSite; i++) {
      const nodeNum = i + 1;
      let nodeY;
      if (nodesPerSite === 1) {
        nodeY = 67;
      } else {
        nodeY = 35 + i * 65;
      }
      
      svg += '    <g transform="translate(10, ' + nodeY + ')">';
      svg += '      <rect width="140" height="55" rx="4" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
      svg += '      <text x="10" y="18" fill="#00f2fe" font-size="9" font-weight="bold">' + getNodeName(nodeNum) + ' (' + state.sizing.controller + ')</text>';
      svg += '      <text x="10" y="32" fill="var(--text-muted)" font-size="8">Plex 0 (Local Disk Loop)</text>';
      svg += '      <text x="10" y="44" fill="var(--text-muted)" font-size="7.5" font-family="monospace">e5a (SwA) | e5b (SwB)</text>';
      svg += '    </g>';
      
      // Node to Switch connections on Site A
      const yA_src = nodeY + 15;
      const yA_dst = swAY + 15 + i * 12;
      const pathA = Math.abs(yA_src - yA_dst) < 2
        ? 'M 150 ' + yA_src + ' L 165 ' + yA_dst
        : 'M 150 ' + yA_src + ' C 158 ' + yA_src + ', 158 ' + yA_dst + ', 165 ' + yA_dst;
        
      const yB_src = nodeY + 27;
      const yB_dst = swBY + 15 + i * 12;
      const pathB = Math.abs(yB_src - yB_dst) < 2
        ? 'M 150 ' + yB_src + ' L 165 ' + yB_dst
        : 'M 150 ' + yB_src + ' C 158 ' + yB_src + ', 158 ' + yB_dst + ', 165 ' + yB_dst;
        
      svg += '    <path d="' + pathA + '" stroke="#00f2fe" stroke-width="1.2" fill="none" opacity="0.85"/>';
      svg += '    <path d="' + pathB + '" stroke="#a855f7" stroke-width="1.2" fill="none" opacity="0.85"/>';
    }
    
    // MetroCluster Switches (Local Site A)
    svg += '    <!-- MetroSwitch A1 -->';
    svg += '    <g transform="translate(165, ' + swAY + ')">';
    svg += '      <rect width="65" height="55" rx="4" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1"/>';
    svg += '      <text x="32.5" y="18" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">' + switchAName + ' 1</text>';
    svg += '      <text x="32.5" y="30" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="7">Ports 1-' + nodesPerSite + '</text>';
    svg += '      <text x="32.5" y="42" text-anchor="middle" fill="#00f2fe" font-size="7" font-weight="bold">ISL 35/36</text>';
    svg += '    </g>';
    
    svg += '    <!-- MetroSwitch B1 -->';
    svg += '    <g transform="translate(165, ' + swBY + ')">';
    svg += '      <rect width="65" height="55" rx="4" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1"/>';
    svg += '      <text x="32.5" y="18" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">' + switchBName + ' 1</text>';
    svg += '      <text x="32.5" y="30" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="7">Ports 1-' + nodesPerSite + '</text>';
    svg += '      <text x="32.5" y="42" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="bold">ISL 35/36</text>';
    svg += '    </g>';
    
    // Local Disk Shelf (Site A)
    svg += '    <g transform="translate(10, ' + storageLoopY + ')">';
    svg += '      <rect width="220" height="90" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(16,185,129,0.15)" stroke-width="1"/>';
    svg += '      <text x="15" y="18" fill="#10b981" font-size="8.5" font-weight="bold">Local Storage Loop (Plex 0)</text>';
    svg += '      <text x="15" y="32" fill="var(--text-muted)" font-size="8">Shelf Count: ' + shelfCount + ' | Type: ' + shelfType + '</text>';
    svg += '      <text x="15" y="45" fill="var(--text-muted)" font-size="8">Usable Capacity: ' + formatCapacity(state.sizing.usableGb) + '</text>';
    svg += '      <rect x="15" y="56" width="190" height="24" rx="3" fill="rgba(16,185,129,0.05)" stroke="rgba(16,185,129,0.2)" stroke-width="0.5"/>';
    svg += '      <text x="22" y="70" fill="#fff" font-size="8" font-weight="bold">Aggregate: ' + (state.volumes[0] ? state.volumes[0].aggregate : "aggr1") + '</text>';
    svg += '      <text x="200" y="70" text-anchor="end" fill="#10b981" font-size="8">Active (Sync)</text>';
    svg += '    </g>';
    svg += '  </g>';

    // 2. Site B (Right Box)
    svg += '  <g transform="translate(540, 80)">';
    svg += '    <rect width="240" height="' + siteBoxHeight + '" rx="8" fill="url(#storageGrad)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="120" y="22" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="700">Site B (Remote DR Site)</text>';
    
    // Draw Site B Nodes
    for (let i = 0; i < nodesPerSite; i++) {
      const nodeNum = halfNodes + i + 1;
      let nodeY;
      if (nodesPerSite === 1) {
        nodeY = 67;
      } else {
        nodeY = 35 + i * 65;
      }
      
      svg += '    <g transform="translate(90, ' + nodeY + ')">';
      svg += '      <rect width="140" height="55" rx="4" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
      svg += '      <text x="10" y="18" fill="#00f2fe" font-size="9" font-weight="bold">' + getNodeName(nodeNum) + ' (' + state.sizing.controller + ')</text>';
      svg += '      <text x="10" y="32" fill="var(--text-muted)" font-size="8">Plex 1 (Remote Mirrored)</text>';
      svg += '      <text x="10" y="44" fill="var(--text-muted)" font-size="7.5" font-family="monospace">e5a (SwA) | e5b (SwB)</text>';
      svg += '    </g>';
      
      // Node to Switch connections on Site B
      const yA_src = nodeY + 15;
      const yA_dst = swAY + 15 + i * 12;
      const pathA = Math.abs(yA_src - yA_dst) < 2
        ? 'M 90 ' + yA_src + ' L 75 ' + yA_dst
        : 'M 90 ' + yA_src + ' C 82 ' + yA_src + ', 82 ' + yA_dst + ', 75 ' + yA_dst;
        
      const yB_src = nodeY + 27;
      const yB_dst = swBY + 15 + i * 12;
      const pathB = Math.abs(yB_src - yB_dst) < 2
        ? 'M 90 ' + yB_src + ' L 75 ' + yB_dst
        : 'M 90 ' + yB_src + ' C 82 ' + yB_src + ', 82 ' + yB_dst + ', 75 ' + yB_dst;
        
      svg += '    <path d="' + pathA + '" stroke="#00f2fe" stroke-width="1.2" fill="none" opacity="0.85"/>';
      svg += '    <path d="' + pathB + '" stroke="#a855f7" stroke-width="1.2" fill="none" opacity="0.85"/>';
    }
    
    // MetroCluster Switches (Local Site B)
    svg += '    <!-- MetroSwitch A2 -->';
    svg += '    <g transform="translate(10, ' + swAY + ')">';
    svg += '      <rect width="65" height="55" rx="4" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1"/>';
    svg += '      <text x="32.5" y="18" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">' + switchAName + ' 2</text>';
    svg += '      <text x="32.5" y="30" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="7">Ports 1-' + nodesPerSite + '</text>';
    svg += '      <text x="32.5" y="42" text-anchor="middle" fill="#00f2fe" font-size="7" font-weight="bold">ISL 35/36</text>';
    svg += '    </g>';
    
    svg += '    <!-- MetroSwitch B2 -->';
    svg += '    <g transform="translate(10, ' + swBY + ')">';
    svg += '      <rect width="65" height="55" rx="4" fill="url(#switchGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1"/>';
    svg += '      <text x="32.5" y="18" text-anchor="middle" fill="#fff" font-size="8" font-weight="700">' + switchBName + ' 2</text>';
    svg += '      <text x="32.5" y="30" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="7">Ports 1-' + nodesPerSite + '</text>';
    svg += '      <text x="32.5" y="42" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="bold">ISL 35/36</text>';
    svg += '    </g>';
    
    // Local Disk Shelf (Site B)
    svg += '    <g transform="translate(10, ' + storageLoopY + ')">';
    svg += '      <rect width="220" height="90" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(16,185,129,0.15)" stroke-width="1"/>';
    svg += '      <text x="15" y="18" fill="#10b981" font-size="8.5" font-weight="bold">DR Storage Loop (Plex 1)</text>';
    svg += '      <text x="15" y="32" fill="var(--text-muted)" font-size="8">Shelf Count: ' + shelfCount + ' | Type: ' + shelfType + '</text>';
    svg += '      <text x="15" y="45" fill="var(--text-muted)" font-size="8">Usable Capacity: ' + formatCapacity(state.sizing.usableGb) + '</text>';
    svg += '      <rect x="15" y="56" width="190" height="24" rx="3" fill="rgba(168,85,247,0.05)" stroke="rgba(168,85,247,0.2)" stroke-width="0.5"/>';
    svg += '      <text x="22" y="70" fill="#fff" font-size="8" font-weight="bold">Aggregate: ' + (state.volumes[0] ? state.volumes[0].aggregate + "_m" : "aggr1_m") + '</text>';
    svg += '      <text x="200" y="70" text-anchor="end" fill="#a855f7" font-size="8">Mirrored</text>';
    svg += '    </g>';
    svg += '  </g>';

    // 3. Site C (Mediator - Top Middle)
    if (mcc.mediator !== "none") {
      svg += '  <g transform="translate(340, 12)">';
      svg += '    <rect width="120" height="50" rx="6" fill="rgba(0,0,0,0.4)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1"/>';
      svg += '    <text x="60" y="16" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Site C (Mediator)</text>';
      svg += '    <text x="60" y="28" text-anchor="middle" fill="#00f2fe" font-size="8">' + mediatorType + '</text>';
      svg += '    <text x="60" y="40" text-anchor="middle" fill="var(--text-muted)" font-size="7">Automatic Failover Active</text>';
      svg += '  </g>';

      // Monitoring link paths (Mediator to Nodes)
      svg += '  <!-- Heartbeat Monitoring Links -->';
      svg += '  <path d="M 340 37 C 240 37, 100 60, 100 115" class="heartbeat-flow" stroke="rgba(0, 242, 254, 0.4)" stroke-width="1" fill="none"/>';
      svg += '  <path d="M 460 37 C 560 37, 700 60, 700 115" class="heartbeat-flow" stroke="rgba(0, 242, 254, 0.4)" stroke-width="1" fill="none"/>';
      svg += '  <text x="290" y="47" fill="#00f2fe" font-size="7">Heartbeat</text>';
      svg += '  <text x="485" y="47" fill="#00f2fe" font-size="7">Heartbeat</text>';
    }

    const islY1 = 80 + swAY + 27.5;
    const islY2 = 80 + swBY + 27.5;
    const statsY = Math.max(islY1, islY2) + 20;

    // 4. Inter-Site Interconnect Switch links (ISL Trunks)
    svg += '  <!-- Fabric A ISLs -->';
    svg += '  <path d="M 250 ' + islY1 + ' L 550 ' + islY1 + '" class="animated-flow" stroke="url(#linkGrad)" stroke-width="2.5" fill="none"/>';
    svg += '  <circle cx="255" cy="' + islY1 + '" r="3" fill="#00f2fe"/>';
    svg += '  <circle cx="545" cy="' + islY1 + '" r="3" fill="#00f2fe"/>';
    svg += '  <text x="400" y="' + (islY1 - 7) + '" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="bold">SyncMirror ISL Fabric A</text>';
    svg += '  <text x="400" y="' + (islY1 + 11) + '" text-anchor="middle" fill="#00f2fe" font-size="7.5" font-family="monospace">Ports 35-36 (2x Trunk)</text>';

    svg += '  <!-- Fabric B ISLs -->';
    svg += '  <path d="M 250 ' + islY2 + ' L 550 ' + islY2 + '" class="animated-flow" stroke="url(#linkGrad)" stroke-width="2.5" fill="none"/>';
    svg += '  <circle cx="255" cy="' + islY2 + '" r="3" fill="#a855f7"/>';
    svg += '  <circle cx="545" cy="' + islY2 + '" r="3" fill="#a855f7"/>';
    svg += '  <text x="400" y="' + (islY2 - 7) + '" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="bold">SyncMirror ISL Fabric B</text>';
    svg += '  <text x="400" y="' + (islY2 + 11) + '" text-anchor="middle" fill="#a855f7" font-size="7.5" font-family="monospace">Ports 35-36 (2x Trunk)</text>';

    // MetroCluster replication stats box (in the center)
    svg += '  <g transform="translate(325, ' + statsY + ')">';
    svg += '    <rect width="150" height="32" rx="4" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>';
    svg += '    <text x="75" y="12" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">' + (isIp ? "MetroCluster IP (Ethernet)" : "MetroCluster FC (Fibre Channel)") + '</text>';
    svg += '    <text x="75" y="22" text-anchor="middle" fill="#00f2fe" font-size="7.5" font-family="monospace">RTT: ' + mcc.latency + ' ms | ' + mcc.distance + ' km</text>';
    svg += '  </g>';

    // 5. Cloud Tier (FabricPool) target for MetroCluster (Bottom Center)
    if (hasFabricPool) {
      svg += '  <!-- MetroCluster FabricPool Cloud Tier -->';
      svg += '  <g transform="translate(340, ' + cloudTierY + ')">';
      svg += '    <rect width="120" height="78" rx="6" fill="url(#storageGrad)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.5"/>';
      svg += '    <text x="60" y="18" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">StorageGRID Tier</text>';
      svg += '    <text x="60" y="32" text-anchor="middle" fill="var(--text-muted)" font-size="8">Bucket: ' + (state.ontapFabricPool.bucket.length > 16 ? state.ontapFabricPool.bucket.substring(0, 14) + ".." : state.ontapFabricPool.bucket) + '</text>';
      svg += '    <text x="60" y="46" text-anchor="middle" fill="#10b981" font-size="8" font-family="monospace">Port: ' + state.ontapFabricPool.port + '</text>';
      svg += '    <text x="60" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="7.5">SSL: ' + (state.ontapFabricPool.sslEnabled ? "ON" : "OFF") + '</text>';
      svg += '  </g>';
      
      // FabricPool Links from both sites (Node loops)
      const fpSrcY = 80 + siteBoxHeight - 90;
      const fpDstY = cloudTierY + 30;
      svg += '  <path d="M 140 ' + fpSrcY + ' C 140 ' + (fpSrcY + 40) + ', 280 ' + fpDstY + ', 340 ' + fpDstY + '" class="animated-flow" stroke="url(#linkGrad)" stroke-width="1.5" fill="none"/>';
      svg += '  <path d="M 660 ' + fpSrcY + ' C 660 ' + (fpSrcY + 40) + ', 520 ' + fpDstY + ', 460 ' + fpDstY + '" class="animated-flow" stroke="url(#linkGrad)" stroke-width="1.5" fill="none"/>';
      svg += '  <text x="400" y="' + (cloudTierY - 8) + '" text-anchor="middle" fill="#10b981" font-size="7" font-weight="bold">FabricPool Links</text>';
    }
    
    svg += '</svg>';
    return svg;
  }
  
  const svgWidth = isSg ? 580 : (hasFabricPool ? 690 : 580);
  const svgHeight = 320;
  let svg = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent; font-family:inherit;">`;
  svg += '  <defs>';
  svg += '    <linearGradient id="hostGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
  svg += '      <stop offset="0%" stop-color="rgba(168, 85, 247, 0.4)"/>';
  svg += '      <stop offset="100%" stop-color="rgba(168, 85, 247, 0.05)"/>';
  svg += '    </linearGradient>';
  svg += '    <linearGradient id="switchGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
  svg += '      <stop offset="0%" stop-color="rgba(0, 242, 254, 0.4)"/>';
  svg += '      <stop offset="100%" stop-color="rgba(0, 242, 254, 0.05)"/>';
  svg += '    </linearGradient>';
  svg += '    <linearGradient id="storageGrad" x1="0%" y1="0%" x2="100%" y2="100%">';
  svg += '      <stop offset="0%" stop-color="rgba(16, 185, 129, 0.4)"/>';
  svg += '      <stop offset="100%" stop-color="rgba(16, 185, 129, 0.05)"/>';
  svg += '    </linearGradient>';
  svg += '    <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">';
  svg += '      <stop offset="0%" stop-color="rgba(168, 85, 247, 0.6)"/>';
  svg += '      <stop offset="50%" stop-color="rgba(0, 242, 254, 0.8)"/>';
  svg += '      <stop offset="100%" stop-color="rgba(16, 185, 129, 0.6)"/>';
  svg += '    </linearGradient>';
  svg += '    <style>';
  svg += '      @keyframes flow { to { stroke-dashoffset: -20; } }';
  svg += '      .animated-flow { stroke-dasharray: 6, 4; animation: flow 1.2s linear infinite; }';
  svg += '    </style>';
  svg += '  </defs>';
  
  if (isSg) {
    const vip = state.sgIntegrations.haVip || "192.168.10.50";
    const port = state.sgIntegrations.lbPort || 10443;
    
    // Left: S3 Client App
    svg += '  <g transform="translate(20, 95)">';
    svg += '    <rect width="110" height="130" rx="8" fill="url(#hostGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="55" y="22" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">S3 Client App</text>';
    svg += '    <text x="55" y="38" text-anchor="middle" fill="var(--text-muted)" font-size="8">AWS CLI / Boto3</text>';
    svg += '    <circle cx="55" cy="80" r="20" fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" stroke-width="1.5"/>';
    svg += '    <text x="55" y="84" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">S3</text>';
    svg += '  </g>';
    
    // Middle: Grid Load Balancer Endpoint
    svg += '  <g transform="translate(150, 95)">';
    svg += '    <rect width="110" height="130" rx="8" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="55" y="22" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">GRID Balancer</text>';
    svg += '    <text x="55" y="38" text-anchor="middle" fill="var(--text-muted)" font-size="8">Port ' + port + '</text>';
    svg += '    <rect x="15" y="65" width="80" height="18" rx="3" fill="rgba(0, 242, 254, 0.1)" stroke="#00f2fe" stroke-width="1"/>';
    svg += '    <text x="55" y="77" text-anchor="middle" fill="#00f2fe" font-size="8" font-family="monospace">' + vip + '</text>';
    svg += '    <text x="55" y="102" text-anchor="middle" fill="var(--text-muted)" font-size="8">SSL Offload</text>';
    svg += '  </g>';
    
    // Right: StorageGRID Engine
    svg += '  <g transform="translate(280, 20)">';
    svg += '    <rect width="280" height="280" rx="8" fill="url(#storageGrad)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="140" y="20" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">StorageGRID Engine</text>';
    
    // Render Tenant Containers
    if (state.sgTenants.length <= 1) {
      // Single Tenant Mode - Span vertically and show up to 4 buckets
      const tenant = state.sgTenants[0] || { name: "Default-Tenant", quota: 500 };
      svg += '    <g transform="translate(10, 35)">';
      svg += '      <rect width="260" height="235" rx="6" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>';
      svg += '      <text x="10" y="18" fill="#fff" font-size="9" font-weight="700">Tenant: ' + tenant.name + '</text>';
      svg += '      <text x="250" y="18" text-anchor="end" fill="var(--text-muted)" font-size="8">' + (tenant.quota ? tenant.quota + " GB" : "Unlimited") + '</text>';
      
      const tBuckets = state.sgBuckets.filter(b => b.tenantName === tenant.name);
      
      // Draw S3 buckets inside Tenant 1 in a 2x2 grid
      const coords = [
        { x: 10, y: 30 },
        { x: 135, y: 30 },
        { x: 10, y: 130 },
        { x: 135, y: 130 }
      ];
      
      tBuckets.slice(0, 4).forEach((bucket, idx) => {
        const c = coords[idx];
        svg += drawBucketSg(bucket, c.x, c.y, 115, 90);
      });
      
      if (tBuckets.length > 4) {
        svg += '      <text x="130" y="228" text-anchor="middle" fill="var(--text-muted)" font-size="8">+ ' + (tBuckets.length - 4) + ' more bucket(s)</text>';
      }
      svg += '    </g>';
    } else {
      // Multi-Tenant Mode - Render top 2 Tenants, and up to 2 buckets each
      state.sgTenants.slice(0, 2).forEach((tenant, tIdx) => {
        const yOffset = tIdx === 0 ? 35 : 155;
        svg += '    <g transform="translate(10, ' + yOffset + ')">';
        svg += '      <rect width="260" height="115" rx="6" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>';
        
        let tName = tenant.name;
        if (tName.length > 18) tName = tName.substring(0, 16) + "..";
        svg += '      <text x="10" y="16" fill="#fff" font-size="9" font-weight="700">Tenant: ' + tName + '</text>';
        svg += '      <text x="250" y="16" text-anchor="end" fill="var(--text-muted)" font-size="8">' + (tenant.quota ? tenant.quota + " GB" : "Unlimited") + '</text>';
        
        const tBuckets = state.sgBuckets.filter(b => b.tenantName === tenant.name);
        
        tBuckets.slice(0, 2).forEach((bucket, bIdx) => {
          const bx = bIdx === 0 ? 10 : 135;
          svg += drawBucketSg(bucket, bx, 25, 115, 80);
        });
        
        if (tBuckets.length > 2) {
          svg += '      <text x="130" y="112" text-anchor="middle" fill="var(--text-muted)" font-size="8">+ ' + (tBuckets.length - 2) + ' more bucket(s)</text>';
        }
        svg += '    </g>';
      });
      
      if (state.sgTenants.length > 2) {
        svg += '    <text x="140" y="285" text-anchor="middle" fill="var(--text-muted)" font-size="8">+ ' + (state.sgTenants.length - 2) + ' more Tenant Account(s)</text>';
      }
    }
    
    svg += '  </g>';
    
    // Connective Lines
    svg += '  <path d="M 130 160 L 150 160" class="animated-flow" stroke="url(#linkGrad)" stroke-width="2" fill="none"/>';
    svg += '  <path d="M 260 160 L 280 160" stroke="url(#linkGrad)" stroke-width="2" fill="none"/>';
    
  } else {
    // ONTAP Platform
    let hostTitle = "Storage Client";
    if (hypervisor === "esxi") hostTitle = "ESXi Host Cluster";
    else if (hypervisor === "hyperv") hostTitle = "Hyper-V Host Cluster";
    else if (hypervisor === "kvm") hostTitle = "KVM Host Cluster";
    else if (db === "oracle") hostTitle = "Oracle Host Database";
    else if (db === "mssql") hostTitle = "MS SQL DB Server";
    else if (db === "postgres") hostTitle = "PostgreSQL Host";
    
    let initiatorLabel = "Storage Access Client";
    let initiatorVal = "IP Address Network";
    if (proto === "iscsi") {
      initiatorLabel = "iSCSI IQN Initiator";
      initiatorVal = state.protocolData.iscsi.initiatorIqn;
    } else if (proto === "fc" || proto === "fcoe") {
      initiatorLabel = "SAN Host WWPNs";
      const wwpns = (proto === "fc" ? state.protocolData.fc.initiatorWwpn : state.protocolData.fcoe.initiatorWwpn).split(",");
      initiatorVal = wwpns[0] || "";
    } else if (proto.startsWith("nvme")) {
      initiatorLabel = "Host NQN Identifier";
      initiatorVal = proto.includes("tcp") ? state.protocolData.nvme_tcp.hostNqn : state.protocolData.nvme_fc.hostNqn;
    }
    
    if (initiatorVal.length > 20) {
      initiatorVal = initiatorVal.substring(0, 18) + "...";
    }
    
    let switchLabel = "Ethernet Network Switch";
    if (switchBrand === "cisco") switchLabel = "Cisco SAN Fabric Switch";
    else if (switchBrand === "brocade") switchLabel = "Brocade SAN Fabric Switch";
    
    const activeSvmName = state.svms[0] ? state.svms[0].name : "svm_data";
    const activeSvmIp = state.svms[0] ? state.svms[0].dataIp : "192.168.20.21";
    
    // Adjust layout depending on FabricPool (whether we have 3 or 4 columns)
    const hostX = hasFabricPool ? 20 : 30;
    const fabricX = hasFabricPool ? 180 : 220;
    const ontapX = hasFabricPool ? 330 : 400;
    
    // 1. Host Node
    svg += '  <g transform="translate(' + hostX + ', 60)">';
    svg += '    <rect width="130" height="190" rx="8" fill="url(#hostGrad)" stroke="rgba(168, 85, 247, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="65" y="25" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">' + hostTitle + '</text>';
    svg += '    <text x="65" y="42" text-anchor="middle" fill="var(--text-muted)" font-size="9">Compute Host</text>';
    
    svg += '    <rect x="8" y="65" width="114" height="50" rx="6" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
    svg += '    <text x="65" y="80" text-anchor="middle" fill="#a855f7" font-size="9" font-weight="bold">' + initiatorLabel + '</text>';
    svg += '    <text x="65" y="98" text-anchor="middle" fill="#fff" font-size="8" font-family="monospace">' + initiatorVal + '</text>';
    
    svg += '    <rect x="8" y="130" width="114" height="45" rx="6" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
    svg += '    <text x="15" y="145" fill="var(--text-muted)" font-size="8">Host Count:</text>';
    svg += '    <text x="115" y="145" text-anchor="end" fill="#fff" font-size="8" font-weight="bold">2 (MPIO)</text>';
    svg += '    <text x="15" y="162" fill="var(--text-muted)" font-size="8">Integration:</text>';
    svg += '    <text x="115" y="162" text-anchor="end" fill="#10b981" font-size="8">Active</text>';
    svg += '  </g>';
    
    // 2. Fabric Node
    svg += '  <g transform="translate(' + fabricX + ', 90)">';
    svg += '    <rect width="120" height="130" rx="8" fill="url(#switchGrad)" stroke="rgba(0, 242, 254, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="60" y="25" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">SAN / Network Fabric</text>';
    svg += '    <text x="60" y="42" text-anchor="middle" fill="var(--text-muted)" font-size="9">' + switchLabel + '</text>';
    
    svg += '    <rect x="10" y="65" width="100" height="45" rx="4" fill="rgba(0, 242, 254, 0.05)" stroke="rgba(0, 242, 254, 0.25)" stroke-width="1"/>';
    svg += '    <text x="18" y="78" fill="var(--text-muted)" font-size="8">Speed:</text>';
    svg += '    <text x="102" y="78" text-anchor="end" fill="#fff" font-size="8">' + state.network.portSpeed + ' Gbps</text>';
    svg += '    <text x="18" y="98" fill="var(--text-muted)" font-size="8">MTU/VLAN:</text>';
    svg += '    <text x="102" y="98" text-anchor="end" fill="#fff" font-size="8">' + state.network.mtu + ' / v' + state.network.vlanId + '</text>';
    svg += '  </g>';
    
    // 3. ONTAP Node
    svg += '  <g transform="translate(' + ontapX + ', 40)">';
    svg += '    <rect width="150" height="240" rx="8" fill="url(#storageGrad)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.5"/>';
    svg += '    <text x="75" y="20" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">NetApp ONTAP Cluster</text>';
    svg += '    <text x="75" y="35" text-anchor="middle" fill="var(--text-muted)" font-size="9">Vserver: ' + activeSvmName + '</text>';
    
    svg += '    <rect x="10" y="50" width="130" height="40" rx="4" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
    svg += '    <text x="18" y="65" fill="#10b981" font-size="8" font-weight="bold">Logical Interfaces (LIFs)</text>';
    svg += '    <text x="18" y="80" fill="#fff" font-size="8" font-family="monospace">' + activeSvmIp + '</text>';
    
    svg += '    <rect x="10" y="100" width="130" height="125" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
    svg += '    <text x="18" y="118" fill="var(--text-muted)" font-size="9" font-weight="bold">Storage Space</text>';
    
    let yPos = 130;
    state.volumes.slice(0, 3).forEach((v, index) => {
      svg += '    <g transform="translate(15, ' + yPos + ')">';
      svg += '      <rect width="120" height="25" rx="3" fill="rgba(0,0,0,0.4)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="0.75"/>';
      
      let nameLabel = v.name;
      if (nameLabel.length > 12) nameLabel = nameLabel.substring(0, 10) + "..";
      svg += '      <text x="8" y="15" fill="#fff" font-size="8" font-weight="bold">' + nameLabel + '</text>';
      svg += '      <text x="112" y="15" text-anchor="end" fill="#10b981" font-size="8">' + v.size + v.sizeUnit + '</text>';
      svg += '    </g>';
      
      yPos += 28;
    });
    
    if (state.volumes.length > 3) {
      svg += '    <text x="75" y="215" text-anchor="middle" fill="var(--text-muted)" font-size="8">+ ' + (state.volumes.length - 3) + ' more volume(s)</text>';
    }
    svg += '  </g>';
    
    // Connective Lines
    svg += '  <path d="M ' + (hostX + 130) + ' 155 L ' + fabricX + ' 155" class="animated-flow" stroke="url(#linkGrad)" stroke-width="2" fill="none"/>';
    svg += '  <path d="M ' + (fabricX + 120) + ' 155 L ' + ontapX + ' 155" stroke="url(#linkGrad)" stroke-width="2" fill="none"/>';
    
    // 4. FabricPool S3 Capacity Tier (Far Right)
    if (hasFabricPool) {
      const bucketLabel = state.ontapFabricPool.bucket.length > 16 ? state.ontapFabricPool.bucket.substring(0, 14) + ".." : state.ontapFabricPool.bucket;
      const targetX = 530;
      
      svg += '  <g transform="translate(' + targetX + ', 60)">';
      svg += '    <rect width="140" height="190" rx="8" fill="url(#storageGrad)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.5"/>';
      svg += '    <text x="70" y="25" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">StorageGRID Cloud Tier</text>';
      svg += '    <text x="70" y="42" text-anchor="middle" fill="var(--text-muted)" font-size="9">Capacity Storage</text>';
      
      svg += '    <rect x="10" y="65" width="120" height="75" rx="6" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
      svg += '    <text x="70" y="85" text-anchor="middle" fill="#10b981" font-size="9" font-weight="bold">Bucket: ' + bucketLabel + '</text>';
      svg += '    <text x="15" y="110" fill="var(--text-muted)" font-size="8">Endpoint:</text>';
      
      let epLabel = state.ontapFabricPool.endpoint;
      if (epLabel.length > 15) epLabel = epLabel.substring(0, 13) + "..";
      svg += '      <text x="125" y="110" text-anchor="end" fill="#fff" font-size="8">' + epLabel + '</text>';
      
      svg += '    <text x="15" y="125" fill="var(--text-muted)" font-size="8">SSL verification:</text>';
      svg += '    <text x="125" y="125" text-anchor="end" fill="' + (state.ontapFabricPool.sslEnabled ? '#10b981' : '#f59e0b') + '" font-size="8">' + (state.ontapFabricPool.sslEnabled ? 'SECURE' : 'INSECURE') + '</text>';
      
      svg += '    <text x="70" y="165" text-anchor="middle" fill="var(--text-muted)" font-size="8">Prot: S3 (Port ' + state.ontapFabricPool.port + ')</text>';
      svg += '  </g>';
      
      // FabricPool Tiering Connection Link
      svg += '  <path d="M ' + (ontapX + 150) + ' 165 L ' + targetX + ' 155" class="animated-flow" stroke="url(#linkGrad)" stroke-width="2" fill="none"/>';
      svg += '  <text x="' + ((ontapX + 150 + targetX) / 2) + '" y="145" text-anchor="middle" fill="#10b981" font-size="7" font-weight="bold">FabricPool Link</text>';
    }
  }
  
  svg += '</svg>';
  return svg;
}

// Helper to draw S3 bucket containers in StorageGRID SVG
function drawBucketSg(b, bx, by, bw, bh) {
  let bsvg = '';
  bsvg += '    <g transform="translate(' + bx + ', ' + by + ')">';
  bsvg += '      <rect width="' + bw + '" height="' + bh + '" rx="5" fill="rgba(0,0,0,0.45)" stroke="rgba(16, 185, 129, 0.4)" stroke-width="1"/>';
  
  let bName = b.name;
  if (bName.length > 18) bName = bName.substring(0, 16) + "..";
  bsvg += '      <text x="' + (bw / 2) + '" y="16" text-anchor="middle" fill="#10b981" font-size="9" font-weight="bold">' + bName + '</text>';
  
  // Versioning & Lock icons
  const vColor = b.versioning ? "#10b981" : "rgba(255,255,255,0.15)";
  const lColor = b.objectLock ? "#f59e0b" : "rgba(255,255,255,0.15)";
  
  bsvg += '      <g transform="translate(10, 24)">';
  bsvg += '        <rect width="45" height="13" rx="2" fill="' + (b.versioning ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)') + '" stroke="' + vColor + '" stroke-width="0.5"/>';
  bsvg += '        <text x="22.5" y="9.5" text-anchor="middle" fill="' + vColor + '" font-size="7" font-weight="bold">VERS</text>';
  bsvg += '      </g>';
  
  bsvg += '      <g transform="translate(60, 24)">';
  bsvg += '        <rect width="45" height="13" rx="2" fill="' + (b.objectLock ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.02)') + '" stroke="' + lColor + '" stroke-width="0.5"/>';
  bsvg += '        <text x="22.5" y="9.5" text-anchor="middle" fill="' + lColor + '" font-size="7" font-weight="bold">LOCK</text>';
  bsvg += '      </g>';
  
  // Platform services pills at the bottom
  let pillX = 10;
  if (b.eventNotifications) {
    bsvg += '      <g transform="translate(' + pillX + ', 42)">';
    bsvg += '        <rect width="28" height="10" rx="2" fill="rgba(168, 85, 247, 0.2)" stroke="rgba(168, 85, 247, 0.5)" stroke-width="0.5"/>';
    bsvg += '        <text x="14" y="7.5" text-anchor="middle" fill="#a855f7" font-size="6" font-weight="bold">SNS</text>';
    bsvg += '      </g>';
    pillX += 32;
  }
  if (b.cloudMirror) {
    bsvg += '      <g transform="translate(' + pillX + ', 42)">';
    bsvg += '        <rect width="32" height="10" rx="2" fill="rgba(6, 182, 212, 0.2)" stroke="rgba(6, 182, 212, 0.5)" stroke-width="0.5"/>';
    bsvg += '        <text x="16" y="7.5" text-anchor="middle" fill="#06b6d4" font-size="6" font-weight="bold">MIRROR</text>';
    bsvg += '      </g>';
    pillX += 36;
  }
  if (b.searchIntegration) {
    bsvg += '      <g transform="translate(' + pillX + ', 42)">';
    bsvg += '        <rect width="26" height="10" rx="2" fill="rgba(236, 72, 153, 0.2)" stroke="rgba(236, 72, 153, 0.5)" stroke-width="0.5"/>';
    bsvg += '        <text x="13" y="7.5" text-anchor="middle" fill="#ec4899" font-size="6" font-weight="bold">ES</text>';
    bsvg += '      </g>';
  }
  
  bsvg += '    </g>';
  return bsvg;
}

// 15. DETAILED ARCHITECTURE DELIVERABLES GENERATORS
function generateBillOfMaterials() {
  const isSg = state.platform === "storagegrid";
  const nodeCount = parseInt(state.sizing.nodeCount);
  const diskCount = parseInt(state.sizing.diskCount);
  
  let bom = `# BILL OF MATERIALS (BOM)\n`;
  bom += `**System Design:** NetApp ${state.platform.toUpperCase()} Storage Infrastructure\n`;
  bom += `**Generated Date:** ${new Date().toLocaleDateString()}\n`;
  bom += `=========================================================================\n\n`;
  
  bom += `### Hardware Inventory\n\n`;
  bom += `| Item | Description | Part Number / Model | Qty | Notes |\n`;
  bom += `| :--- | :--- | :--- | :---: | :--- |\n`;
  
  // Controllers
  if (isSg) {
    bom += `| **StorageGRID Nodes** | Enterprise StorageGRID Hardware Appliance | ${state.sizing.controller} | ${nodeCount} | Distributed Grid storage nodes. |\n`;
  } else {
    bom += `| **Controller Pair** | High-Availability Controller Enclosure | AFF-${state.sizing.controller} | ${nodeCount / 2} | HA Controller Pairs (dual-controller configurations). |\n`;
  }
  
  // Shelves
  if (!isSg || state.sizing.shelfType !== "virtual") {
    let shelfQty = 0;
    if (state.sizing.shelfType === "NS224" || state.sizing.shelfType === "DS224C") {
      shelfQty = Math.ceil(diskCount / 24) * (isSg ? nodeCount : nodeCount / 2);
    } else if (state.sizing.shelfType === "DS212C") {
      shelfQty = Math.ceil(diskCount / 12) * (isSg ? nodeCount : nodeCount / 2);
    } else if (state.sizing.shelfType !== "none" && state.sizing.shelfType !== "virtual") {
      shelfQty = Math.ceil(diskCount / 60) * (isSg ? nodeCount : nodeCount / 2);
    }
    
    // Scale for MetroCluster DR
    if (!isSg && state.metrocluster && state.metrocluster.enabled) {
      shelfQty *= 2;
    }
    
    if (shelfQty > 0) {
      bom += `| **Storage Expansion Shelf** | Expansion Disk Shelf Enclosure | ${state.sizing.shelfType} | ${shelfQty} | Direct-attached storage expansion shelf. |\n`;
    }
  }
  
  // Disk Drives
  let totalDrives = 0;
  if (isSg) {
    totalDrives = nodeCount * diskCount;
  } else {
    totalDrives = (nodeCount / 2) * diskCount;
    if (state.metrocluster && state.metrocluster.enabled) {
      totalDrives *= 2;
    }
  }
  bom += `| **Disk Drives** | Storage Media Disk Drives | ${state.sizing.diskSize} SSD/HDD | ${totalDrives} | Main data capacity disks (configured in RAID arrays). |\n`;
  
  // Storage Expansion PCIe Cards
  if (!isSg) {
    const model = state.sizing.controller;
    const shelfType = state.sizing.shelfType;
    const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
    
    let numPairs = Math.max(1, nodeCount / 2);
    let shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
    if (state.metrocluster && state.metrocluster.enabled) {
      const halfNodes = nodeCount / 2;
      const mPairs = Math.max(1, halfNodes / 2);
      shelvesPerPair = Math.max(1, Math.ceil(shelfCount / mPairs));
    }
    
    const sizingInfo = getExpansionCardsAndPorts(model, shelfType, shelvesPerPair);
    if (sizingInfo.cards.length > 0) {
      const cardMap = {};
      sizingInfo.cards.forEach(card => {
        if (!cardMap[card.partNumber]) {
          cardMap[card.partNumber] = {
            description: card.description,
            slots: []
          };
        }
        cardMap[card.partNumber].slots.push(card.slot);
      });
      
      for (const [partNumber, info] of Object.entries(cardMap)) {
        const qty = nodeCount * info.slots.length;
        const slotsStr = info.slots.map(s => `Slot ${s}`).join(", ");
        bom += `| **Storage PCIe Expansion Card** | ${info.description} | ${partNumber} | ${qty} | Symmetrical population in ${slotsStr} on all ${nodeCount} controllers. |\n`;
      }
    }
  }

  // Switches
  if (state.platform === "ontap") {
    if (state.sizing.clusterCabling === "switched") {
      bom += `| **Cluster Switch** | High-Speed Cluster Interconnect Switch | Cisco Nexus 9336C-FX2 | 2 | Redundant cluster interconnect switches. |\n`;
    }
    const hasSan = state.protocols && state.protocols.some(p => ["iscsi", "fc", "fcoe", "nvme_tcp", "nvme_fc"].includes(p));
    if (hasSan && state.network.zoningEnable) {
      const switchModel = state.network.switchBrand === "cisco" ? "Cisco MDS 9148T" : "Brocade G620";
      bom += `| **Fabric Switch** | FC/FCoE Storage Area Network Switch | ${switchModel} | 2 | Redundant fabric switches. |\n`;
    }
  } else {
    bom += `| **Gateway Switch** | 25/100GbE Grid Connection Switch | Cisco Nexus 93180YC-FX | 2 | Client/Grid network switches. |\n`;
  }
  
  // Cables & Optics
  let cableQty = nodeCount * 4;
  bom += `| **Network Cables** | Optical Fiber Patch Cables (LC-LC OM4) | CAB-OM4-LC-10M | ${cableQty} | Node data network switch links. |\n`;
  bom += `| **Transceivers** | 25G SFP28 Optical Modules | X-SFPP-25G-SR | ${cableQty} | Controller SFP data transceivers. |\n`;
  
  bom += `\n### Software Licenses & Support Subscriptions\n\n`;
  bom += `| Item | Description | Scope | Status | Notes |\n`;
  bom += `| :--- | :--- | :--- | :--- | :--- |\n`;
  
  if (isSg) {
    bom += `| **StorageGRID Software License** | S3 compliance and ILM lifecycle management engine | Per TB Capacity | **INCLUDED** | Node capacity-based runtime licenses. |\n`;
  } else {
    bom += `| **ONTAP One License** | Unified base + premium software bundle (NFS, SMB, SAN) | Per Controller Pair | **INCLUDED** | Standard ONTAP software licensing. |\n`;
    if (state.metrocluster && state.metrocluster.enabled) {
      bom += `| **SyncMirror DR License** | MetroCluster replication and failover software | Per Controller Pair | **INCLUDED** | MetroCluster disaster recovery engine. |\n`;
    }
    if (state.ontapFabricPool.enabled) {
      bom += `| **FabricPool Tiering** | Automated cold data block cloud tiering engine | Per TB Capacity | **ACTIVE** | Cloud tier capacity license. |\n`;
    }
    if (state.trident && state.trident.enabled) {
      bom += `| **Astra Trident CSI** | Kubernetes dynamic storage orchestrator | Cluster Scope | **OPEN SOURCE** | Kubernetes host integration driver. |\n`;
    }
  }
  
  bom += `| **Support Subscription** | NetApp SupportEdge Premium 24x7x4hr | Co-Terminus | **3-YEAR CONTRACT** | Support subscription. |\n`;
  
  return bom;
}

function generateSizingReport() {
  const isSg = state.platform === "storagegrid";
  let report = `# SIZING & CAPACITY ANALYTICAL REPORT\n`;
  report += `**Design Platform:** NetApp ${state.platform.toUpperCase()} Storage sizer\n`;
  report += `**Generated Date:** ${new Date().toLocaleDateString()}\n`;
  report += `=========================================================================\n\n`;
  
  report += `### 1. Capacity Overhead Rules\n\n`;
  
  if (isSg) {
    report += `* **OS & System Reserves:** 15% of physical drives capacity is reserved for OS partitions and Cassandra metadata databases.\n`;
    report += `* **Declustered Parity (DDP):** 2 parity drives and 2 hot-spare replacements are reserved per appliance node.\n`;
    report += `* **Information Lifecycle Management (ILM) Multiplier:** User logical capacity is mapped based on selected protection rules.\n\n`;
  } else {
    report += `* **RAID-DP / RAID-TEC Parity:** Parity disks are deducted based on RAID configuration (default 2 per group for RAID-DP, 3 for RAID-TEC).\n`;
    report += `* **Hot Spares:** Hot spare disk drives are deducted from the physical pool (default 2 per aggregate).\n`;
    report += `* **WAFL System Overhead:** 10% system reservation is deducted for system filesystem maps.\n`;
    report += `* **Snapshot Reserve:** Adjusts usable pool size based on snapshot retention requirements (default 5%).\n\n`;
  }
  
  report += `### 2. Sizing Configuration Specs\n\n`;
  report += `| Sizing Parameter | Configured Value |\n`;
  report += `| :--- | :--- |\n`;
  report += `| **Controller Model** | ${state.sizing.controller} |\n`;
  report += `| **Physical Disk Shelves** | ${state.sizing.shelfType} |\n`;
  report += `| **Physical Disk Model** | ${state.sizing.diskSize} |\n`;
  report += `| **Drive Count per Node/Pair** | ${state.sizing.diskCount} drives |\n`;
  
  if (!isSg) {
    report += `| **RAID Protection Type** | RAID-${state.sizing.raidType.toUpperCase()} |\n`;
    report += `| **RAID Group Size** | ${state.sizing.raidGroupSize} drives |\n`;
    report += `| **Hot Spare Drives** | ${state.sizing.spareDisks} drives |\n`;
    if (state.metrocluster && state.metrocluster.enabled) {
      report += `| **SyncMirror Plex Copies** | 2 (Local + Remote Plex) |\n`;
    }
  } else {
    report += `| **ILM Data Policy** | ${state.sgIntegrations.ilmPolicy.toUpperCase()} |\n`;
  }
  
  return report;
}

function generatePerformanceReport() {
  const perf = calculatePerformanceMetrics();
  let r = `# PERFORMANCE & METRICS EVALUATION SHEET\n`;
  r += `**Design Platform:** NetApp Storage Performance Model\n`;
  r += `**Generated Date:** ${new Date().toLocaleDateString()}\n`;
  r += `=========================================================================\n\n`;
  
  r += `### 1. Solution Performance Thresholds\n\n`;
  r += `| Metric | Estimated Design Cap | Description |\n`;
  r += `| :--- | :---: | :--- |\n`;
  r += `| **Est. Peak IOPS** | ${perf.iops.toLocaleString()} IOPS | Max random read/write input operations per second. |\n`;
  r += `| **Est. Throughput** | ${(perf.throughputMb / 1000).toFixed(1)} GB/s | Maximum sequential data transfer bandwidth. |\n`;
  r += `| **Est. Average Latency** | ${perf.latencyMs.toFixed(2)} ms | Average response times under standard workloads. |\n`;
  r += `| **Protocol Network Speed** | ${state.network.portSpeed} Gbps | Link transport speed per data port interface. |\n`;
  
  r += `\n### 2. Quality of Service (QoS) Policy Definitions\n\n`;
  if (state.platform === "storagegrid") {
    r += `* **Object Traffic Classification:** Quality of service is managed using StorageGRID Traffic Classification rules (limiting S3 API requests by tenant, bucket, or subnet client IPs).\n`;
  } else {
    r += `| Parameter | QoS Setting | Notes |\n`;
    r += `| :--- | :--- | :--- |\n`;
    r += `| **QoS Policy Type** | ${state.qos.policyType.toUpperCase()} | Policy application (None / Shared / Non-Shared / Adaptive). |\n`;
    r += `| **Expected IOPS Guarantee (Floor)** | ${state.qos.expectedIops} IOPS | Guaranteed performance allocated. |\n`;
    r += `| **Peak IOPS Limit (Ceiling)** | ${state.qos.peakIops} IOPS | Hard performance ceiling limits. |\n`;
    r += `| **Peak Throughput Limit** | ${state.qos.peakThroughput} MB/s | Hard sequential transfer throughput ceiling. |\n`;
    r += `| **Adaptive Peak IOPS per TB** | ${state.qos.peakIopsPerTb} IOPS/TB | Scales ceiling dynamically based on logical volume sizes. |\n`;
  }
  
  return r;
}

function generateConfigurationGuidelines() {
  const isSg = state.platform === "storagegrid";
  let g = `# CONFIGURATION GUIDELINES & BEST PRACTICES\n`;
  g += `**Design Platform:** NetApp ${state.platform.toUpperCase()} Deployment Blueprint\n`;
  g += `**Generated Date:** ${new Date().toLocaleDateString()}\n`;
  g += `=========================================================================\n\n`;
  
  g += `### 1. Network Connectivity & Switch Configuration\n\n`;
  g += `* **MTU (Jumbo Frames):** Configure MTU to **9000** on all data switch ports, LIF interfaces, and client NICs.\n`;
  g += `* **LACP (Link Aggregation):** Implement Link Aggregation Control Protocol (LACP) using Multi-chassis EtherChannel (VPC on Cisco Nexus) to bundle node data ports.\n`;
  g += `* **VLAN Tagging:** Ensure correct VLAN tagging (**VLAN ID: ${state.network.vlanId}**) is configured.\n\n`;
  
  g += `### 2. SAN Fabrics & Zoning Best Practices\n\n`;
  const activeProtos = state.protocols || [state.protocol];
  if (activeProtos.some(p => ["fc", "fcoe", "nvme_fc", "iscsi"].includes(p))) {
    g += `* **Single-Initiator Single-Target Zoning:** Implement single-initiator single-target zoning on fabric switches to isolate host initiator ports.\n`;
    g += `* **Path Redundancy:** Ensure multi-pathing drivers (ALUA) are enabled on hosts.\n\n`;
  } else {
    g += `* **Block Storage Bypass:** Direct Ethernet cabling is used. SAN fabrics zoning is not required.\n\n`;
  }
  
  g += `### 3. Storage System Configuration\n\n`;
  if (isSg) {
    g += `* **ILM Lifecycle Policies:** Run a minimum of 2 copies replication or Erasure Coding protection depending on object sizes.\n`;
    g += `* **Load Balancer Endpoints:** Run Grid Gateways in High Availability (HA) groups with active virtual IPs (VIP).\n`;
  } else {
    g += `* **RAID Group Optimization:** For SSD disk shelves, keep RAID-DP groups sized between 20 and 28 disks. For HDD, size them between 12 and 20 disks.\n`;
    g += `* **Thin Provisioning:** Enable thin provisioning (\`-space-guarantee none\`) and deduplication/compression efficiencies on volumes.\n`;
  }
  
  return g;
}

function generateVolumeLunConfig() {
  const isSg = state.platform === "storagegrid";
  let v = `# VOLUME, LUN, AND OBJECT BUCKET PROVISIONING DETAILS\n`;
  v += `**Design Platform:** NetApp Logical Resource Mapping Sheet\n`;
  v += `**Generated Date:** ${new Date().toLocaleDateString()}\n`;
  v += `=========================================================================\n\n`;
  
  if (isSg) {
    v += `### StorageGRID S3 Buckets & Tenant Allocation\n\n`;
    v += `| S3 Tenant | Bucket Name | Region | Versioning | Object Lock | Retention Period | Cloud Mirror | Search Integration |\n`;
    v += `| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;
    state.sgBuckets.forEach(b => {
      v += `| ${b.tenantName} | ${b.name} | ${b.region} | ${b.versioning ? 'ENABLED' : 'DISABLED'} | ${b.objectLock ? 'ENABLED' : 'DISABLED'} | ${b.objectLock ? b.retentionDays + ' Days' : 'N/A'} | ${b.cloudMirror ? 'ENABLED' : 'DISABLED'} | ${b.searchIntegration ? 'ENABLED' : 'DISABLED'} |\n`;
    });
  } else {
    v += `### ONTAP Volumes & LUN Allocations\n\n`;
    v += `| SVM | Volume Name | Size | Protocols | Aggregate | QoS Profile | FabricPool Tiering | LUNs / Namespaces |\n`;
    v += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    state.volumes.forEach(vol => {
      const activeProtos = state.protocols || [state.protocol];
      const protoStr = activeProtos.map(p => p.toUpperCase()).join(", ");
      let lunStr = "None";
      if (vol.luns && vol.luns.length > 0) {
        lunStr = vol.luns.map(l => `${l.name} (${l.size}${l.sizeUnit})`).join("<br>");
      }
      let fpPolicy = vol.fabricpool || "none";
      if (fpPolicy === true) fpPolicy = "auto";
      if (fpPolicy === false) fpPolicy = "none";
      let fpStr = fpPolicy.toUpperCase();
      if ((fpPolicy === "auto" || fpPolicy === "snapshot-only") && vol.coolingDays && vol.coolingDays !== 31) {
        fpStr += ` (${vol.coolingDays} days)`;
      }
      v += `| ${vol.svmName} | ${vol.name} | ${vol.size} ${vol.sizeUnit} | ${protoStr} | ${vol.aggregate} | ${state.qos.policyType.toUpperCase()} | ${fpStr} | ${lunStr} |\n`;
    });
  }
  
  return v;
}

function getNetworkTrafficFlows() {
  const isSg = state.platform === "storagegrid";
  const activeProtos = state.protocols || [state.protocol || "nfs"];
  const flows = [];

  if (!isSg) {
    // ONTAP Management Flows
    flows.push({
      src: "Admin Workstation",
      dst: "ONTAP Node / Cluster MGMT",
      port: "TCP 443",
      service: "HTTPS",
      desc: "ONTAP System Manager & REST API administrative access."
    });
    flows.push({
      src: "Admin Workstation",
      dst: "ONTAP Node / Cluster MGMT",
      port: "TCP 22",
      service: "SSH",
      desc: "ONTAP command-line interface (CLI) administration access."
    });
    flows.push({
      src: "ONTAP Controller",
      dst: "Syslog Server",
      port: "UDP 514",
      service: "Syslog",
      desc: "Storage cluster event telemetry logging and alert forwarding."
    });
    flows.push({
      src: "ONTAP Controller",
      dst: "SNMP Manager",
      port: "UDP 161 / 162",
      service: "SNMP",
      desc: "Monitoring queries and trap notifications."
    });
    flows.push({
      src: "ONTAP Controller",
      dst: "DNS Server",
      port: "UDP/TCP 53",
      service: "DNS",
      desc: "Infrastructure domain name resolution queries."
    });
    flows.push({
      src: "ONTAP Controller",
      dst: "NTP Server",
      port: "UDP 123",
      service: "NTP",
      desc: "Time synchronization services for cluster nodes."
    });
    flows.push({
      src: "ONTAP Controller (MGMT)",
      dst: "NetApp Support (ASUP)",
      port: "TCP 443",
      service: "HTTPS",
      desc: "AutoSupport diagnostic telemetry and health uploads."
    });

    // ONTAP Protocols
    if (activeProtos.includes("nfs")) {
      flows.push({
        src: "Client Host / VM",
        dst: "ONTAP Data LIF",
        port: "TCP/UDP 111",
        service: "Portmap",
        desc: "RPC port mapper service for NFS."
      });
      flows.push({
        src: "Client Host / VM",
        dst: "ONTAP Data LIF",
        port: "TCP/UDP 2049",
        service: "NFS",
        desc: "Network File System (NFS) v3/v4 file mount and access."
      });
      flows.push({
        src: "Client Host / VM",
        dst: "ONTAP Data LIF",
        port: "TCP/UDP 4045",
        service: "Mountd",
        desc: "NFS mount daemon communication."
      });
      flows.push({
        src: "Client Host / VM",
        dst: "ONTAP Data LIF",
        port: "TCP/UDP 4046",
        service: "Nlockmgr",
        desc: "NFS Network Lock Manager (NLM) protocol."
      });
      flows.push({
        src: "Client Host / VM",
        dst: "ONTAP Data LIF",
        port: "TCP/UDP 4049",
        service: "Rquotad",
        desc: "Remote quota reporting service."
      });
    }

    if (activeProtos.includes("smb")) {
      flows.push({
        src: "Client Host / User",
        dst: "ONTAP Data LIF",
        port: "TCP 445",
        service: "SMB/CIFS",
        desc: "Microsoft Server Message Block (SMB) v2/v3 file access."
      });
      flows.push({
        src: "Client Host / User",
        dst: "ONTAP Data LIF",
        port: "TCP 139",
        service: "NetBIOS-SSN",
        desc: "Legacy NetBIOS session services."
      });
      flows.push({
        src: "Client Host / User",
        dst: "ONTAP Data LIF",
        port: "UDP 137 / 138",
        service: "NetBIOS-NS / DGM",
        desc: "NetBIOS name resolution and datagram distribution."
      });
      flows.push({
        src: "ONTAP Controller",
        dst: "Active Directory (DC)",
        port: "TCP/UDP 389",
        service: "LDAP",
        desc: "Domain controller directory queries and user validation."
      });
      flows.push({
        src: "ONTAP Controller",
        dst: "Active Directory (DC)",
        port: "TCP 636",
        service: "LDAPS",
        desc: "Secure LDAP over SSL for directory queries."
      });
      flows.push({
        src: "ONTAP Controller",
        dst: "Active Directory (DC)",
        port: "TCP/UDP 88",
        service: "Kerberos",
        desc: "Kerberos authentication ticket requests."
      });
      flows.push({
        src: "ONTAP Controller",
        dst: "Active Directory (DC)",
        port: "TCP 464",
        service: "Kerberos kpasswd",
        desc: "Active Directory password management services."
      });
      flows.push({
        src: "ONTAP Controller",
        dst: "Active Directory (DC)",
        port: "TCP 3268 / 3269",
        service: "Global Catalog",
        desc: "AD Forest search services (HTTP/HTTPS secure/non-secure)."
      });
    }

    if (activeProtos.includes("iscsi")) {
      flows.push({
        src: "Client Initiator",
        dst: "ONTAP Data LIF",
        port: "TCP 3260",
        service: "iSCSI",
        desc: "Internet SCSI block storage command path and payload."
      });
    }

    if (activeProtos.includes("nvme_tcp")) {
      flows.push({
        src: "Client Host Initiator",
        dst: "ONTAP Data LIF",
        port: "TCP 4420",
        service: "NVMe/TCP",
        desc: "NVMe-oF over TCP fabric block storage commands."
      });
    }

    if (activeProtos.includes("ontap_s3")) {
      flows.push({
        src: "Client Application",
        dst: "ONTAP Data LIF",
        port: "TCP 80 / 443",
        service: "HTTP/HTTPS",
        desc: "ONTAP S3 object APIs operations (GET/PUT/DELETE)."
      });
    }

    if (activeProtos.includes("fc") || activeProtos.includes("fcoe")) {
      flows.push({
        src: "Client Host HBA",
        dst: "ONTAP Target Port",
        port: "FC Physical Fabric",
        service: "FCP",
        desc: "Fibre Channel Protocol block data transport (Layer 4 FC)."
      });
    }

    if (activeProtos.includes("nvme_fc")) {
      flows.push({
        src: "Client Host HBA",
        dst: "ONTAP Target Port",
        port: "FC Physical Fabric",
        service: "NVMe/FC",
        desc: "NVMe over Fibre Channel block storage commands (Layer 4 FC)."
      });
    }

    // KMS Encryption
    const hasEncryption = state.volumes && state.volumes.some(v => v.encryption);
    if (hasEncryption) {
      flows.push({
        src: "ONTAP Controller",
        dst: "Key Manager (KMS)",
        port: "TCP 5696",
        service: "KMIP",
        desc: "Key Management Interoperability Protocol for securing keys."
      });
    }

    // FabricPool
    if (state.ontapFabricPool && state.ontapFabricPool.enabled) {
      const fpPort = state.ontapFabricPool.port || (state.ontapFabricPool.sslEnabled ? 443 : 80);
      flows.push({
        src: "ONTAP Intercluster LIF",
        dst: `StorageGRID Cloud Target`,
        port: `TCP ${fpPort}`,
        service: state.ontapFabricPool.sslEnabled ? "HTTPS (S3)" : "HTTP (S3)",
        desc: `FabricPool cold block storage auto-tiering to S3 bucket [${state.ontapFabricPool.bucket}].`
      });
    }

    // Cluster Peering
    flows.push({
      src: "ONTAP Intercluster LIF",
      dst: "Peer Intercluster LIF",
      port: "TCP 11104",
      service: "ONTAP Cluster Peering",
      desc: "Cluster Peering session control and handshake negotiation."
    });
    flows.push({
      src: "ONTAP Intercluster LIF",
      dst: "Peer Intercluster LIF",
      port: "TCP 11105",
      service: "ONTAP Cluster Peering",
      desc: "SnapMirror / SnapVault multi-path replication data transfer."
    });

    // Trident CSI
    if (state.trident && state.trident.enabled) {
      flows.push({
        src: "Kubernetes Node (Trident)",
        dst: "ONTAP Management LIF",
        port: "TCP 443",
        service: "ONTAP REST API / SDK",
        desc: "Trident CSI orchestration backend control requests."
      });
      flows.push({
        src: "Kubernetes Node (Agent)",
        dst: "ONTAP Data LIF",
        port: "TCP 3260 / 2049",
        service: "iSCSI / NFS",
        desc: "Kubernetes container volume provisioning mount path."
      });
    }
  } else {
    // StorageGRID Flows
    flows.push({
      src: "Admin Workstation",
      dst: "StorageGRID Admin Node",
      port: "TCP 443",
      service: "Grid Manager (HTTPS)",
      desc: "StorageGRID global administration UI and management API."
    });
    flows.push({
      src: "Admin Workstation",
      dst: "StorageGRID Admin Node",
      port: "TCP 9443",
      service: "Tenant Manager (HTTPS)",
      desc: "StorageGRID tenant self-service portal (bucket config, users)."
    });
    flows.push({
      src: "Admin Workstation",
      dst: "StorageGRID Nodes",
      port: "TCP 22",
      service: "SSH",
      desc: "Appliance operating system SSH and console troubleshooting."
    });
    flows.push({
      src: "StorageGRID Nodes",
      dst: "DNS Server",
      port: "UDP/TCP 53",
      service: "DNS",
      desc: "Domain name resolution for grid infrastructure and targets."
    });
    flows.push({
      src: "StorageGRID Nodes",
      dst: "NTP Server",
      port: "UDP 123",
      service: "NTP",
      desc: "Clock synchronization across nodes (critical metadata integrity)."
    });
    flows.push({
      src: "StorageGRID Admin Node",
      dst: "NetApp Support (ASUP)",
      port: "TCP 443",
      service: "HTTPS",
      desc: "AutoSupport diagnostic logs and alert telemetry reporting."
    });

    // Client/LB access
    const lbPort = state.sgIntegrations.lbPort || 10443;
    const lbProto = (state.sgIntegrations.lbProtocol || "https").toUpperCase();
    const haVip = state.sgIntegrations.haVip || "192.168.10.50";
    flows.push({
      src: "S3 Client App",
      dst: `StorageGRID Gateway VIP [${haVip}]`,
      port: `TCP ${lbPort}`,
      service: `S3 Load Balancer (${lbProto})`,
      desc: "S3 object client requests (GET, PUT, DELETE, LIST)."
    });
    flows.push({
      src: "S3 Client App",
      dst: "StorageGRID Storage Node",
      port: "TCP 18082",
      service: "Direct S3 (HTTP)",
      desc: "Direct HTTP S3 data operations bypassing the load balancer."
    });
    flows.push({
      src: "S3 Client App",
      dst: "StorageGRID Storage Node",
      port: "TCP 18084",
      service: "Direct S3 (HTTPS)",
      desc: "Direct HTTPS S3 data operations bypassing the load balancer."
    });

    // Internal Grid communications
    flows.push({
      src: "StorageGRID Nodes",
      dst: "StorageGRID Nodes",
      port: "TCP 7001",
      service: "Cassandra Metadata Sync",
      desc: "Inter-node Cassandra database metadata updates propagation."
    });
    flows.push({
      src: "StorageGRID Nodes",
      dst: "StorageGRID Nodes",
      port: "TCP 80 / 443",
      service: "Grid Control Plane",
      desc: "Inter-node system status, config replication, and administrative sync."
    });
    flows.push({
      src: "StorageGRID Nodes",
      dst: "StorageGRID Nodes",
      port: "TCP 18086",
      service: "LDR Grid Data Path",
      desc: "Inter-node object data replication and erasure coding traffic."
    });

    // LDAP/AD
    flows.push({
      src: "StorageGRID Admin Node",
      dst: "LDAP / Active Directory",
      port: "TCP 389",
      service: "LDAP",
      desc: "Directory credentials validation for console users."
    });
    flows.push({
      src: "StorageGRID Admin Node",
      dst: "LDAP / Active Directory",
      port: "TCP 636",
      service: "LDAPS",
      desc: "Secure SSL directory lookup and tenant login authentication."
    });

    // KMS Encryption
    if (state.sgIntegrations.kmsProvider !== "none" && state.sgIntegrations.kmsProvider !== "none_kms") {
      flows.push({
        src: "StorageGRID Storage Node",
        dst: "Key Manager (KMS)",
        port: "TCP 5696",
        service: "KMIP",
        desc: "Retrieval of cryptographic appliance-level hardware keys."
      });
    }
  }

  return flows;
}

function generateNetworkTrafficMatrix(format = "markdown") {
  const flows = getNetworkTrafficFlows();
  
  if (format === "markdown") {
    let md = `## Network TCP/UDP Ports & Traffic Flows\n\n`;
    md += `The following table details all required TCP/UDP network ports, communication directions, source/destination components, and functional descriptions for the active storage architecture:\n\n`;
    md += `| Source Component | Destination Component | Protocol / Port | Service / Role | Flow Description |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    flows.forEach(f => {
      md += `| ${f.src} | ${f.dst} | ${f.port} | ${f.service} | ${f.desc} |\n`;
    });
    md += `\n`;
    return md;
  } else {
    // HTML format
    let html = ``;
    html += `<div class="guide-card">`;
    html += `  <h2>Network TCP/UDP Ports & Traffic Flows</h2>`;
    html += `  <p>The matrix below outlines the firewall rules and port mapping required between individual infrastructure components:</p>`;
    html += `  <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">`;
    html += `    <thead>`;
    html += `      <tr>`;
    html += `        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--glass-border);">Source</th>`;
    html += `        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--glass-border);">Destination</th>`;
    html += `        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--glass-border);">Protocol/Port</th>`;
    html += `        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--glass-border);">Service</th>`;
    html += `        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--glass-border);">Description</th>`;
    html += `      </tr>`;
    html += `    </thead>`;
    html += `    <tbody>`;
    flows.forEach(f => {
      html += `      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">`;
      html += `        <td style="padding: 8px; color: #fff;"><strong>${f.src}</strong></td>`;
      html += `        <td style="padding: 8px; color: var(--text-secondary);">${f.dst}</td>`;
      html += `        <td style="padding: 8px; color: var(--color-accent-cyan); font-family: monospace;">${f.port}</td>`;
      html += `        <td style="padding: 8px;"><span class="parser-badge" style="background: rgba(0, 242, 254, 0.1); color: var(--color-accent-cyan); border: 1px solid rgba(0, 242, 254, 0.2); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">${f.service}</span></td>`;
      html += `        <td style="padding: 8px; color: var(--text-muted); font-size: 0.78rem;">${f.desc}</td>`;
      html += `      </tr>`;
    });
    html += `    </tbody>`;
    html += `  </table>`;
    html += `</div>`;
    return html;
  }
}

function generateHldLldDesign() {
  let doc = `# HIGH-LEVEL DESIGN (HLD) & LOW-LEVEL DESIGN (LLD) SPECIFICATIONS\n`;
  doc += `**Design Platform:** NetApp Solution Architect Engineering Pack\n`;
  doc += `**Generated Date:** ${new Date().toLocaleDateString()}\n`;
  doc += `=========================================================================\n\n`;
  
  doc += `## 1. High-Level Design (HLD)\n\n`;
  doc += `The High-Level Design illustrates the structural layout of the storage nodes, networks, and client tiers.\n\n`;
  
  const proposalText = generatePresalesProposalMarkdown();
  if (proposalText.includes("## 3. High-Level Design (HLD) Topology")) {
    doc += `### HLD Architectural ASCII Flowchart\n`;
    doc += `\`\`\`\n`;
    doc += proposalText.split("## 3. High-Level Design (HLD) Topology")[1].split("##")[0].trim();
    doc += `\n\`\`\`\n\n`;
  }
  
  doc += `## 2. Low-Level Design (LLD)\n\n`;
  doc += `The Low-Level Design specifies physical switch connectivity matrices, cabling layouts, port mappings, and exact drive slot configurations.\n\n`;
  
  if (state.platform === "ontap") {
    doc += `### Physical Cabling Matrix\n`;
    const cablingEl = document.getElementById("cablingAsciiDiagram");
    const cablingContent = cablingEl ? cablingEl.textContent : "";
    if (cablingContent) {
      doc += `\`\`\`\n${cablingContent}\n\`\`\`\n\n`;
    } else {
      doc += `Direct node loop connectivity is configured.\n\n`;
    }
    
    doc += `### Controller Port Assignments\n`;
    const ports = getControllerPorts(state.sizing.controller);
    doc += `* **Cluster Ports:** ${ports.cluster.join(", ")}\n`;
    doc += `* **Storage shelf interface ports:** ${ports.storage.join(", ")}\n`;
    
    const model = state.sizing.controller;
    const shelfType = state.sizing.shelfType;
    const shelfCount = Math.max(1, Math.ceil(state.sizing.diskCount / 24));
    const nodeCount = parseInt(state.sizing.nodeCount);
    
    let numPairs = Math.max(1, nodeCount / 2);
    let shelvesPerPair = Math.max(1, Math.ceil(shelfCount / numPairs));
    if (state.metrocluster && state.metrocluster.enabled) {
      const halfNodes = nodeCount / 2;
      const mPairs = Math.max(1, halfNodes / 2);
      shelvesPerPair = Math.max(1, Math.ceil(shelfCount / mPairs));
    }
    
    const sizingInfo = getExpansionCardsAndPorts(model, shelfType, shelvesPerPair);
    if (sizingInfo.cards.length > 0) {
      doc += `* **Storage Expansion PCIe Cards:**\n`;
      sizingInfo.cards.forEach(card => {
        doc += `  - Card: ${card.partNumber} (${card.description}) in **Slot ${card.slot}** (Ports: ${card.ports.join(", ")})\n`;
      });
    }
    
    doc += `* **Data network interface ports:** ${ports.data.join(", ")}\n`;
    doc += `* **Node Out-of-band Management port:** ${ports.management || "e0M"}\n\n`;
  } else {
    doc += `### StorageGRID Appliance Networks\n`;
    doc += `* **Grid Network:** Traverses switch interfaces back to centralized administration containers.\n`;
    doc += `* **Client Network:** Serves S3 API requests from client applications.\n`;
    doc += `* **Admin Network:** Restricts access to administrative console operations.\n\n`;
  }

  doc += `\n`;
  doc += generateNetworkTrafficMatrix("markdown");
  
  return doc;
}

window.downloadDeliverable = function(type) {
  let filename = "";
  let content = "";
  
  switch (type) {
    case 'hld_lld':
      filename = "hld_lld_design.md";
      content = generateHldLldDesign();
      break;
    case 'proposal':
      filename = "presales_proposal.md";
      content = generatePresalesProposalMarkdown();
      break;
    case 'bom':
      filename = "bill_of_materials.md";
      content = generateBillOfMaterials();
      break;
    case 'sizing':
      filename = "sizing_capacity_report.md";
      content = generateSizingReport();
      break;
    case 'performance':
      filename = "performance_metrics.md";
      content = generatePerformanceReport();
      break;
    case 'guidelines':
      filename = "configuration_guidelines.md";
      content = generateConfigurationGuidelines();
      break;
    case 'commands':
      filename = state.platform === "storagegrid" ? "storagegrid_api_commands.txt" : "ontap_cli_commands.txt";
      content = state.platform === "storagegrid" ? generateStoragegridCliCode() : generateOntapCliCode();
      break;
    case 'volumes':
      filename = state.platform === "storagegrid" ? "storagegrid_bucket_details.md" : "volume_lun_details.md";
      content = generateVolumeLunConfig();
      break;
    case 'config':
      filename = "netapp_config.json";
      content = JSON.stringify(state, null, 2);
      break;
    default:
      alert("Invalid deliverable document requested.");
      return;
  }
  safeTriggerDownload(filename, content);
};
