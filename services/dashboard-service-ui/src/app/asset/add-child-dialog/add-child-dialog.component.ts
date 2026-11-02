import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AssetService } from 'src/app/services/asset-service.service';

// interface AssetTypeOption {
//   name:string,
//   id:string
// }




@Component({
  selector: 'app-add-child-dialog',
  standalone: false,
  templateUrl: './add-child-dialog.component.html',
  styleUrl: './add-child-dialog.component.scss'
})
export class AddChildDialogComponent implements OnInit {

  @Input() addChildDialogModal: boolean = false;
  @Output() addChildDialogModalChange = new EventEmitter<boolean>();
  @Output() assetCreated = new EventEmitter<any>();
  @Input() assetId: string = '';

  availableAssetTypes: any[] = []
  assetForm!: FormGroup;

  // assetTypes: AssetTypeOption[] = [];

  constructor(
    private readonly assetService: AssetService,
    private fb: FormBuilder
  ) { }


  ngOnInit(): void {
    this.assetService.getAllAssetTypes().subscribe((assetTypesResponse) => {
      this.availableAssetTypes = [...assetTypesResponse]
    })

    this.assetForm = this.fb.group({
      assetType: ['', Validators.required],
      assetTypeId: [{ value: '', disabled: true }],
      name: ['', Validators.required],
      description: [''],
      location: [''],
      parentAsset: [{ value: this.assetId, disabled: true }]
    })

    this.assetForm.get('assetType')?.valueChanges.subscribe((selectedId: string) => {
      this.assetForm.get('assetTypeId')?.setValue(selectedId || '');
    });

  }

  onSubmit() {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      return;
    }

    const formValue = this.assetForm.getRawValue();
    const asset = {
      name: formValue.name,
      assetTypeId: formValue.assetType,
      description: formValue.description || undefined,
      location: formValue.location || undefined,
      ...(formValue.parentAsset ? { parentAssetId: formValue.parentAsset } : {})
    };

    this.assetService.createAsset(asset).subscribe({
      next: (createdAsset) => {
        this.assetCreated.emit(createdAsset);
        this.hideDialog();
      }
    });
  }

  hideDialog() {
    this.addChildDialogModalChange.emit(false)
  }





}
