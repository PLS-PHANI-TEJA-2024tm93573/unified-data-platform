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
      assetTypeId: [{ value: '', disabled: true }, Validators.required],
      description: [''],
      location: [''],
      parentAsset: [{ value: this.assetId, disabled: true }, Validators.required]
    })

    this.assetForm.get('assetType')?.valueChanges.subscribe((selectedId: string) => {
      if (selectedId) {
        console.log(selectedId)
        // Patch assetTypeId control with the selected ID value
        this.assetForm.patchValue({
          assetTypeId: selectedId
        });
      }
    });


  }

  onSubmit() {
    this.hideDialog()
  }

  hideDialog() {
    this.addChildDialogModalChange.emit(false)
  }





}
